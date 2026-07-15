'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATION_EVENT_META, type NotificationEvent } from '@/lib/notify'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type UpdateEmailResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

/**
 * Starts an email-address change for the current user. Supabase sends a
 * confirmation link to the new address; the login email (and the mirrored
 * profiles.email — reconciled on next load) only change once the user confirms.
 */
export async function updateEmailAddress(formData: FormData): Promise<UpdateEmailResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const newEmail = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(newEmail)) return { ok: false, error: 'Enter a valid email address.' }
  if (newEmail === (user.email ?? '').toLowerCase()) {
    return { ok: false, error: 'That is already your current email address.' }
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/app/profile')
  return {
    ok: true,
    message: `Confirmation link sent to ${newEmail}. Your email changes once you confirm it.`,
  }
}

export async function saveNotificationPrefs(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load existing prefs to preserve keys we don't own (e.g. digestDeliveryTime)
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .maybeSingle()

  const existing =
    profile?.notification_prefs &&
    typeof profile.notification_prefs === 'object' &&
    !Array.isArray(profile.notification_prefs)
      ? (profile.notification_prefs as Record<string, unknown>)
      : {}

  const events: Record<string, { inApp: boolean; email: boolean; whatsapp: boolean }> = {}
  for (const event of Object.keys(NOTIFICATION_EVENT_META) as NotificationEvent[]) {
    events[event] = {
      inApp: formData.get(`events.${event}.inApp`) === 'on',
      email: formData.get(`events.${event}.email`) === 'on',
      whatsapp: false,
    }
  }

  await supabase
    .from('profiles')
    .update({ notification_prefs: { ...existing, events } })
    .eq('id', user.id)

  revalidatePath('/app/profile')
}
