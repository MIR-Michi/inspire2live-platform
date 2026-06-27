import { NextResponse } from 'next/server'
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

  if (!isAiEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI features are disabled.' }, { status: 503 })
  }

  try {
    const claim = await markConferenceRunStarted()
    if (!claim.started) {
      return NextResponse.json({ ok: true, skipped: 'already_running' })
    }
    await executeAndRecordConferenceRun(null)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Conference discovery job failed.' },
      { status: 500 }
    )
  }
}
