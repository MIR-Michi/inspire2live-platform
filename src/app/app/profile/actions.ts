'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATION_EVENT_META, type NotificationEvent } from '@/lib/notify'

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
