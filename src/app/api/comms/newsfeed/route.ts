import { NextResponse } from 'next/server'
import { denyUnauthorizedCron } from '@/kernel/identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { runOrgNewsfeedJob } from '@/lib/ai/org-newsfeed-job'

export const maxDuration = 300

export async function GET(request: Request) {
  const denied = denyUnauthorizedCron(request)
  if (denied) return denied

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
