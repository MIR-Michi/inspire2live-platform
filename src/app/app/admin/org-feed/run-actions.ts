'use server'

import { after } from 'next/server'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { executeAndRecordRun, getRunStatus, markRunStarted } from '@/lib/ai/org-newsfeed-run'
import type { OrgNewsfeedRunStatus } from '@/lib/ai/org-feed-config'

export type StartRunResult = {
  ok: boolean
  status: OrgNewsfeedRunStatus['status']
  message?: string
}

/**
 * Kick off a background newsfeed generation run and return immediately. The
 * actual web-search job runs after the response via `after()`, and the UI polls
 * getOrgNewsfeedStatus() until it completes. Admin-only.
 */
export async function startOrgNewsfeedRun(): Promise<StartRunResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 'idle', message: 'Not authenticated.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) return { ok: false, status: 'idle', message: 'Only a Platform Admin can run the feed.' }
  if (!isAiEnabled()) return { ok: false, status: 'idle', message: 'AI features are disabled for this environment.' }

  const claim = await markRunStarted()
  if (!claim.started) {
    if (claim.reason === 'already_running') return { ok: true, status: 'running', message: 'A run is already in progress.' }
    return { ok: false, status: 'idle', message: 'Save a configuration before running.' }
  }

  const userId = user.id
  after(async () => {
    await executeAndRecordRun(userId)
  })

  return { ok: true, status: 'running' }
}

/** Read the latest run status. Available to the comms team (read-only). */
export async function getOrgNewsfeedStatus(): Promise<OrgNewsfeedRunStatus | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) return null

  // org_feed_config is admin-only under RLS; read run status via the service role.
  return getRunStatus(createAdminClient())
}
