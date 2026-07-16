/**
 * GET /api/congress-guest/workspace?token=<raw>
 *
 * Public: returns the guest workspace data for a token (submissions, files, notes).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.includes('@') ? email : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = (searchParams.get('token') ?? '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_guest_workspace', {
    raw_token: token,
  })

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or expired' }, { status: 404 })
  }

  const workspace = data as {
    token?: { id?: string | null; contactEmail?: string | null }
    submissions?: Array<{ submitterEmail?: string | null }>
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let hasPlatformAccess = false

  if (serviceRoleKey) {
    try {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const emails = new Set<string>()
      const workspaceEmail = normalizeEmail(workspace.token?.contactEmail)
        ?? normalizeEmail(workspace.submissions?.[0]?.submitterEmail)
      if (workspaceEmail) emails.add(workspaceEmail)

      const tokenId = typeof workspace.token?.id === 'string' ? workspace.token.id : null
      if (tokenId) {
        const { data: tokenRow } = await admin
          .from('conference_guest_tokens')
          .select('contact_id, contact_email')
          .eq('id', tokenId)
          .maybeSingle()

        const tokenEmail = normalizeEmail(tokenRow?.contact_email)
        if (tokenEmail) emails.add(tokenEmail)

        if (tokenRow?.contact_id) {
          const { data: contact } = await admin
            .from('comms_crm_contacts')
            .select('profile_id, platform_status, email')
            .eq('id', tokenRow.contact_id)
            .maybeSingle()

          const contactEmail = normalizeEmail(contact?.email)
          if (contactEmail) emails.add(contactEmail)

          // The CRM contact spine is the strongest identity signal. A linked
          // profile or active platform state means this person is already a user,
          // even if the invite snapshot used another/case-variant email value.
          hasPlatformAccess = Boolean(contact?.profile_id) || contact?.platform_status === 'active'
        }
      }

      if (!hasPlatformAccess) {
        for (const email of emails) {
          const { data: profile } = await admin
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle()
          if (profile?.id) {
            hasPlatformAccess = true
            break
          }
        }
      }
    } catch {
      hasPlatformAccess = false
    }
  }

  return NextResponse.json({
    ...(data as Record<string, unknown>),
    token: {
      ...((data as { token?: Record<string, unknown> }).token ?? {}),
      hasPlatformAccess,
    },
  })
}
