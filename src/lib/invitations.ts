/**
 * lib/invitations.ts
 *
 * Server-side invitation logic.
 * All functions assume a Supabase server client is passed in.
 * Auth + RLS enforce permissions at the DB layer;
 * we additionally check server-side with canInvite().
 *
 * NOTE: The `invitations`, `initiative_members` and `email_log` tables were added
 * in migration 00025.  Until `supabase gen types` is re-run the generated Database
 * type doesn't know about them, so we use `supabase.rpc` / raw `from` casts with
 * explicit `// eslint-disable` where necessary.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type InviteScope = 'initiative' | 'congress'
export type InviteStatus = 'invited' | 'accepted' | 'declined' | 'revoked'

export interface InviteResult {
  ok: boolean
  error?: string
  invitationId?: string
  emailSent?: boolean
}

export interface ProfileSuggestion {
  id: string
  name: string
  email: string
  role: string
}

export interface InvitationRecord {
  id: string
  scope: InviteScope
  initiative_id: string | null
  congress_id: string | null
  invitee_user_id: string | null
  invitee_email: string | null
  invitee_role: string
  status: InviteStatus
  invited_at: string
  responded_at: string | null
  invited_by: string
  message: string | null
}

function mapInvitationDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Unknown invitation error.'

  const msg = (error.message ?? '').toLowerCase()

  // Supabase/PostgREST when table is missing from schema cache
  if (
    error.code === 'PGRST205' ||
    msg.includes("could not find the table 'public.invitations'") ||
    msg.includes('schema cache') ||
    msg.includes('relation "public.invitations" does not exist')
  ) {
    return (
      'Invitation system is not enabled in this environment yet. ' +
      'Apply Supabase migration 00025_invitation_system.sql and reload schema (notify pgrst, \'reload schema\').' 
    )
  }

  return error.message ?? 'Unknown invitation error.'
}

// ─── Shortcut for untyped tables ─────────────────────────────────────────────

function db(supabase: SupabaseClient<Database>) {
  // Cast to any so we can query tables not yet in generated types
  return supabase as any
}

// ─── Permission guard ─────────────────────────────────────────────────────────

/**
 * Returns true if the current session user may invite others.
 * Only HubCoordinator and PlatformAdmin are allowed.
 */
export async function canInvite(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (data?.role as string | null) ?? ''
  return role === 'PlatformAdmin' || role === 'Superadmin' || role === 'HubCoordinator'
}

// ─── Autocomplete search ──────────────────────────────────────────────────────

/**
 * Search profiles by partial name or email match.
 * Returns up to 10 suggestions.
 * RLS ensures only accessible profiles are returned.
 * Profile column is `name` (not full_name) per current schema.
 */
export async function searchProfiles(
  supabase: SupabaseClient<Database>,
  query: string
): Promise<ProfileSuggestion[]> {
  if (!query || query.trim().length < 2) return []

  const term = query.trim()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(10)

  if (error || !data) return []

  return (data as any[]).map((p: any) => ({
    id: p.id as string,
    name: (p.name as string | null) ?? (p.email as string | null) ?? p.id.slice(0, 8),
    email: (p.email as string | null) ?? '',
    role: (p.role as string | null) ?? 'PatientAdvocate',
  }))
}

// ─── Create invitation ────────────────────────────────────────────────────────

interface CreateInviteParams {
  scope: InviteScope
  initiativeId?: string
  congressId?: string
  inviteeUserId?: string
  inviteeEmail?: string
  inviteeRole: string
  message?: string
}

export async function createInvitation(
  supabase: SupabaseClient<Database>,
  params: CreateInviteParams
): Promise<InviteResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const allowed = await canInvite(supabase)
  if (!allowed) {
    return { ok: false, error: 'Only Hub Coordinators and Platform Admins may send invitations.' }
  }

  if (!params.inviteeUserId && !params.inviteeEmail) {
    return { ok: false, error: 'Must specify either a user or an email address.' }
  }
  if (params.scope === 'initiative' && !params.initiativeId) {
    return { ok: false, error: 'Initiative ID required for initiative invitations.' }
  }
  if (params.scope === 'congress' && !params.congressId) {
    return { ok: false, error: 'Congress ID required for congress invitations.' }
  }

  // duplicate invite check
  const existing = await checkExistingInvite(supabase, params)
  if (existing) {
    return { ok: false, error: 'An invitation to this person is already pending or active.' }
  }

  // duplicate membership check
  const alreadyMember = await checkExistingMembership(supabase, params)
  if (alreadyMember) {
    return { ok: false, error: 'This person is already a member.' }
  }

  const { data, error } = await db(supabase)
    .from('invitations')
    .insert({
      scope: params.scope,
      initiative_id: params.initiativeId ?? null,
      congress_id: params.congressId ?? null,
      invitee_user_id: params.inviteeUserId ?? null,
      invitee_email: params.inviteeEmail ?? null,
      invitee_role: params.inviteeRole,
      message: params.message ?? null,
      invited_by: user.id,
      status: 'invited',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'An invitation to this person already exists.' }
    }
    return { ok: false, error: mapInvitationDbError(error) }
  }

  return { ok: true, invitationId: (data as any).id as string }
}

// ─── Revoke invitation ────────────────────────────────────────────────────────

export async function revokeInvitation(
  supabase: SupabaseClient<Database>,
  invitationId: string
): Promise<InviteResult> {
  const allowed = await canInvite(supabase)
  if (!allowed) {
    return { ok: false, error: 'Only Hub Coordinators and Platform Admins may revoke invitations.' }
  }

  const { error } = await db(supabase)
    .from('invitations')
    .update({ status: 'revoked', responded_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('status', 'invited')

  if (error) return { ok: false, error: mapInvitationDbError(error) }
  return { ok: true }
}

// ─── Accept / Decline (self-service by invitee) ───────────────────────────────

export async function respondToInvitation(
  supabase: SupabaseClient<Database>,
  invitationId: string,
  response: 'accepted' | 'declined'
): Promise<InviteResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Use SECURITY DEFINER RPC because invitees cannot insert into initiative_members
  // due to strict RLS (only coordinators/admins can manage membership rows).
  const { data, error } = await db(supabase).rpc('respond_to_invitation', {
    inv_id: invitationId,
    response,
  })

  if (error) return { ok: false, error: mapInvitationDbError(error) }
  if (!data || !(data as { ok?: boolean }).ok) {
    return { ok: false, error: 'Invitation response failed.' }
  }

  return { ok: true }
}

// ─── List invitations for a scope ────────────────────────────────────────────

export async function listInvitations(
  supabase: SupabaseClient<Database>,
  scope: InviteScope,
  targetId: string
): Promise<InvitationRecord[]> {
  const col = scope === 'initiative' ? 'initiative_id' : 'congress_id'

  const { data, error } = await db(supabase)
    .from('invitations')
    .select('*')
    .eq(col, targetId)
    .order('invited_at', { ascending: false })

  if (error || !data) return []
  return data as InvitationRecord[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkExistingInvite(
  supabase: SupabaseClient<Database>,
  params: CreateInviteParams
): Promise<boolean> {
  const col = params.scope === 'initiative' ? 'initiative_id' : 'congress_id'
  const targetId = params.scope === 'initiative' ? params.initiativeId : params.congressId

  let q = db(supabase)
    .from('invitations')
    .select('id')
    .eq(col, targetId!)
    .in('status', ['invited', 'accepted'])

  if (params.inviteeUserId) {
    q = q.eq('invitee_user_id', params.inviteeUserId)
  } else {
    q = q.eq('invitee_email', params.inviteeEmail!)
  }

  const { data } = await q.maybeSingle()
  return !!data
}

async function checkExistingMembership(
  supabase: SupabaseClient<Database>,
  params: CreateInviteParams
): Promise<boolean> {
  if (!params.inviteeUserId) return false

  if (params.scope === 'initiative' && params.initiativeId) {
    const { data } = await db(supabase)
      .from('initiative_members')
      .select('id')
      .eq('initiative_id', params.initiativeId)
      .eq('user_id', params.inviteeUserId)
      .eq('invite_status', 'accepted')
      .maybeSingle()
    return !!data
  }

  if (params.scope === 'congress' && params.congressId) {
    const { data } = await db(supabase)
      .from('congress_members')
      .select('id')
      .eq('congress_id', params.congressId)
      .eq('user_id', params.inviteeUserId)
      .eq('invite_status', 'accepted')
      .maybeSingle()
    return !!data
  }

  return false
}
