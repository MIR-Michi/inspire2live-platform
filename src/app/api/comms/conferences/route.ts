import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { executeAndRecordConferenceRun, markConferenceRunStarted } from '@/lib/ai/conference-run'

export const maxDuration = 300

/**
 * Monthly cron: refresh the upcoming-oncology-conferences list. Protected by
 * CRON_SECRET. Claims the singleton run lock (so a manual run and the cron can't
 * collide), then runs + records the discovery job within the 300s window so the
 * UI reflects the outcome.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return runDiscovery(null)
}

/**
 * Manual run from the Conferences page. This intentionally runs in a route
 * handler, not in a server-action `after()` callback: in production that callback
 * can leave the status row stuck at "running" without executing the AI sweep.
 */
export async function POST() {
  const supabase = await createClient()
  const auth = await supabase.auth.getUser()
  const user = auth.data.user
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) {
    return NextResponse.json({ ok: false, error: 'You do not have access to the Conferences workspace.' }, { status: 403 })
  }

  return runDiscovery(user.id)
}

async function runDiscovery(userId: string | null) {
  if (!isAiEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI features are disabled.' }, { status: 503 })
  }

  try {
    const claim = await markConferenceRunStarted()
    if (!claim.started) {
      return NextResponse.json({ ok: true, skipped: 'already_running' })
    }
    await executeAndRecordConferenceRun(userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Conference discovery job failed.' },
      { status: 500 }
    )
  }
}
