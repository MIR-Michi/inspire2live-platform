import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { runOrgNewsfeedJob } from '@/lib/ai/org-newsfeed-job'

export const maxDuration = 300

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
    const supabase = createAdminClient()
    const result = await runOrgNewsfeedJob(supabase)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Org newsfeed job failed.' },
      { status: 500 }
    )
  }
}
