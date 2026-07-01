'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { createGuestToken, sendGuestTokenLink } from '@/lib/congress-guest-tokens'
import { resolveOrCreateCrmContact } from '@/lib/comms-conference-contacts'

export type GenerateTokenState = {
  ok: boolean
  url?: string
  error?: string
  sends?: Array<{ channel: string; ok: boolean; error?: string }>
}

export type GenericGuestInviteResult = {
  name: string
  ok: boolean
  url?: string
  error?: string
}

export type GenericGuestInviteState = {
  ok: boolean
  error?: string
  results?: GenericGuestInviteResult[]
}

type GenericGuestInput = {
  contactId?: string | null
  fullName?: string | null
  email?: string | null
  whatsappId?: string | null
  addToCrm?: boolean | null
}

type ResolvedGuest = {
  contactId?: string
  fullName: string
  email: string | null
  whatsappId: string | null
}

function text(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function requireCommsUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authenticated.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return { ok: false as const, error: 'Access denied.' }
  }

  return { ok: true as const, supabase, userId: user.id }
}

function parseGenericGuests(raw: FormDataEntryValue | null): GenericGuestInput[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, 40).map((item) => typeof item === 'object' && item !== null ? item as GenericGuestInput : {})
  } catch {
    return []
  }
}

async function resolveGenericGuest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  input: GenericGuestInput
): Promise<ResolvedGuest> {
  // Delegates to the shared conference-contact resolver so every invite flow
  // dedupes and creates CRM contacts the same way.
  const resolved = await resolveOrCreateCrmContact(admin, userId, {
    contactId: input.contactId,
    fullName: input.fullName,
    email: input.email,
    whatsappId: input.whatsappId,
    createIfMissing: input.addToCrm !== false,
    sourceLabel: 'Conference attendance invite',
    tags: ['conference-guest'],
    notes: 'Created from the generic conference attendance invite flow.',
  })
  return {
    contactId: resolved.contactId,
    fullName: resolved.fullName,
    email: resolved.email,
    whatsappId: resolved.whatsappId,
  }
}

/**
 * Generates generic guest attendance links for one or more guests. These tokens
 * are intentionally not tied to a conference, so the guest selects the conference
 * as the first step in the public form.
 */
export async function sendGenericGuestInvites(
  _prev: GenericGuestInviteState,
  formData: FormData
): Promise<GenericGuestInviteState> {
  const auth = await requireCommsUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  const guests = parseGenericGuests(formData.get('guests'))
  const sendEmail = formData.get('sendEmail') === 'true'
  const sendWhatsapp = formData.get('sendWhatsapp') === 'true'

  if (guests.length === 0) return { ok: false, error: 'Add at least one guest.' }
  if (!sendEmail && !sendWhatsapp) return { ok: false, error: 'Select email, WhatsApp, or both.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const results: GenericGuestInviteResult[] = []

  for (const guestInput of guests) {
    let guestName = text(guestInput.fullName, 180) ?? 'Guest'
    try {
      const guest = await resolveGenericGuest(admin, auth.userId, guestInput)
      guestName = guest.fullName

      if (sendEmail && !guest.email) throw new Error('No email address available.')
      if (sendWhatsapp && !guest.whatsappId) throw new Error('No WhatsApp number available.')

      const token = await createGuestToken(admin, auth.userId, {
        contactId: guest.contactId,
        contactName: guest.fullName,
        contactEmail: guest.email ?? undefined,
        contactPhone: guest.whatsappId ?? undefined,
      })
      if (!token.ok) throw new Error(token.error)

      const sends = await sendGuestTokenLink({
        url: token.url,
        contactName: guest.fullName,
        contactEmail: guest.email,
        contactPhone: guest.whatsappId,
        channels: { email: sendEmail, whatsapp: sendWhatsapp },
      })
      const failed = sends.find((send) => !send.ok)
      if (failed) throw new Error(`${failed.channel}: ${failed.error ?? 'send failed'}`)

      if (guest.contactId) {
        await admin.from('comms_crm_interactions').insert({
          contact_id: guest.contactId,
          interaction_type: sendEmail && sendWhatsapp ? 'note' : sendEmail ? 'email' : 'whatsapp',
          summary: `Generic conference attendance form invite sent via ${[
            sendEmail ? 'email' : null,
            sendWhatsapp ? 'WhatsApp' : null,
          ].filter(Boolean).join(' and ')}.`,
          occurred_at: new Date().toISOString(),
          created_by: auth.userId,
        })
        await admin.from('comms_crm_contacts').update({
          lifecycle_stage: 'active',
          last_interaction_at: new Date().toISOString(),
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        }).eq('id', guest.contactId)
      }

      results.push({ name: guest.fullName, ok: true, url: token.url })
    } catch (error) {
      results.push({ name: guestName, ok: false, error: error instanceof Error ? error.message : 'Invite failed.' })
    }
  }

  revalidatePath('/app/comms/conferences')
  revalidatePath('/app/comms/conferences/submissions')
  revalidatePath('/app/comms/crm')
  revalidatePath('/app/comms/crm/people')

  const sent = results.filter((result) => result.ok).length
  return {
    ok: sent > 0,
    error: sent > 0 ? undefined : 'No invites were sent.',
    results,
  }
}

/**
 * Generates a magic-link token for a CRM contact and optionally sends it
 * via WhatsApp and/or email.
 */
export async function generateGuestToken(
  _prev: GenerateTokenState,
  formData: FormData
): Promise<GenerateTokenState> {
  const auth = await requireCommsUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  const contactId = (formData.get('contactId') as string | null) ?? undefined
  const contactName = ((formData.get('contactName') as string | null) ?? '').trim() || undefined
  const contactEmail = ((formData.get('contactEmail') as string | null) ?? '').trim() || undefined
  const contactPhone = ((formData.get('contactPhone') as string | null) ?? '').trim() || undefined
  const conferenceId = (formData.get('conferenceId') as string | null) ?? undefined
  const conferenceName = (formData.get('conferenceName') as string | null) ?? undefined
  const sendWhatsapp = formData.get('sendWhatsapp') === 'true'
  const sendEmail = formData.get('sendEmail') === 'true'

  if (!contactName) {
    return { ok: false, error: 'Add the guest name before sending an invite.' }
  }
  if (!sendEmail && !sendWhatsapp) {
    return { ok: false, error: 'Select email, WhatsApp, or both.' }
  }
  if (sendEmail && !contactEmail) {
    return { ok: false, error: 'Add an email address or untick Email.' }
  }
  if (sendWhatsapp && !contactPhone) {
    return { ok: false, error: 'Add a WhatsApp number or untick WhatsApp.' }
  }

  // Persist a manually-typed guest to the CRM (same path the bulk invite and
  // "Assign attendees" use), so a single-invite guest isn't silently dropped.
  let resolvedContactId = contactId
  if (!contactId) {
    try {
      const resolved = await resolveOrCreateCrmContact(createAdminClient(), auth.userId, {
        fullName: contactName,
        email: contactEmail ?? null,
        whatsappId: contactPhone ?? null,
        sourceLabel: 'Conference attendance invite',
        tags: ['conference-guest'],
        notes: conferenceName
          ? `Invited to report attendance for ${conferenceName}.`
          : 'Created from a conference attendance invite.',
      })
      resolvedContactId = resolved.contactId
    } catch {
      // Non-fatal: still send the invite even if the CRM insert fails.
    }
  }

  const result = await createGuestToken(auth.supabase, auth.userId, {
    contactId: resolvedContactId,
    contactName,
    contactEmail,
    contactPhone,
    conferenceId,
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const sends = await sendGuestTokenLink({
    url: result.url,
    conferenceName,
    contactName,
    contactPhone: contactPhone ?? null,
    contactEmail: contactEmail ?? null,
    channels: { whatsapp: sendWhatsapp, email: sendEmail },
  })

  revalidatePath('/app/comms/conferences/submissions')
  revalidatePath('/app/admin/guest-submissions')

  return { ok: true, url: result.url, sends }
}

export type ReviewSubmissionState = { ok: boolean; error?: string }

/**
 * Approve or reject a guest submission.
 */
export async function reviewGuestSubmission(
  _prev: ReviewSubmissionState,
  formData: FormData
): Promise<ReviewSubmissionState> {
  const auth = await requireCommsUser()
  if (!auth.ok) return { ok: false, error: auth.error }

  const submissionId = formData.get('submissionId') as string
  const action = formData.get('action') as 'approve' | 'reject'
  const reviewNotes = (formData.get('reviewNotes') as string | null) ?? null

  if (!submissionId || !['approve', 'reject'].includes(action)) {
    return { ok: false, error: 'Invalid request.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (auth.supabase as any)
    .from('conference_guest_submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq('id', submissionId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/app/comms/conferences/submissions')
  revalidatePath('/app/admin/guest-submissions')
  return { ok: true }
}
