'use server'

import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  executeAndRecordConferenceRun,
  getConferenceRunStatus,
  markConferenceRunStarted,
  type ConferenceRunStatus,
} from '@/lib/ai/conference-run'

export type StartConferenceRunResult = {
  ok: boolean
  status: ConferenceRunStatus['status']
  message?: string
}

export async function startConferenceRun(): Promise<StartConferenceRunResult> {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return { ok: false, status: 'idle', message: 'Not authenticated.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return { ok: false, status: 'idle', message: 'You do not have access to the Conferences workspace.' }
  if (!isAiEnabled()) return { ok: false, status: 'idle', message: 'AI features are disabled for this environment.' }

  const claim = await markConferenceRunStarted()
  if (!claim.started) {
    return { ok: true, status: 'running', message: 'A discovery run is already in progress.' }
  }

  const userId = user.id
  after(async () => {
    await executeAndRecordConferenceRun(userId)
  })

  return { ok: true, status: 'running', message: 'Discovery started. Preparing regional searches.' }
}

export async function getConferenceStatus(): Promise<ConferenceRunStatus | null> {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return null

  return getConferenceRunStatus(createAdminClient())
}
