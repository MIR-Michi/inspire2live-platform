'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { createGuestToken, sendGuestTokenLink } from '@/lib/congress-guest-tokens'

export type GenerateTokenState = {
  ok: boolean
  url?: string
  error?: string
  sends?: Array<{ channel: string; ok: boolean; error?: string }>
}

/**
 * Generates a magic-link token for a CRM contact and optionally sends it
 * via WhatsApp and/or email.
 */
export async function generateGuestToken(
  _prev: GenerateTokenState,
  formData: FormData
): Promise<GenerateTokenState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return { ok: false, error: 'Access denied.' }
  }

  const contactId = (formData.get('contactId') as string | null) ?? undefined
  const contactName = (formData.get('contactName') as string | null) ?? undefined
  const contactEmail = (formData.get('contactEmail') as string | null) ?? undefined
  const contactPhone = (formData.get('contactPhone') as string | null) ?? undefined
  const conferenceId = (formData.get('conferenceId') as string | null) ?? undefined
  const conferenceName = (formData.get('conferenceName') as string | null) ?? undefined
  const sendWhatsapp = formData.get('sendWhatsapp') === 'true'
  const sendEmail = formData.get('sendEmail') === 'true'

  const result = await createGuestToken(supabase, user.id, {
    contactId,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return { ok: false, error: 'Access denied.' }
  }

  const submissionId = formData.get('submissionId') as string
  const action = formData.get('action') as 'approve' | 'reject'
  const reviewNotes = (formData.get('reviewNotes') as string | null) ?? null

  if (!submissionId || !['approve', 'reject'].includes(action)) {
    return { ok: false, error: 'Invalid request.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('conference_guest_submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq('id', submissionId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/app/admin/guest-submissions')
  return { ok: true }
}
