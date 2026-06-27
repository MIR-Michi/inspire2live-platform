'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { getConferenceRunStatus, type ConferenceRunStatus } from '@/lib/ai/conference-run'

export async function getConferenceStatus(): Promise<ConferenceRunStatus | null> {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return null

  return getConferenceRunStatus(createAdminClient())
}
