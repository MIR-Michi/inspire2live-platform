import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendScheduledCommsDigests, type DigestHighlight } from '@/lib/comms-digest'
import { countPendingProposals, planningAdminDb } from '@/modules/podcast-planning'

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Composed here rather than inside the digest so the content component
    // stays unaware of the podcast planner. A failure to count must not stop
    // the digest going out.
    const highlights: DigestHighlight[] = []
    try {
      const pending = await countPendingProposals(await planningAdminDb())
      if (pending > 0) {
        highlights.push({
          text: `Radar has ${pending} new topic${pending === 1 ? '' : 's'} to look at`,
          href: `${baseUrl}/app/comms/podcast?tab=planning&screen=radar`,
        })
      }
    } catch (error) {
      console.error('[digest] Radar highlight skipped:', error)
    }

    const results = await sendScheduledCommsDigests(supabase, baseUrl, new Date(), highlights)

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Digest job failed.',
      },
      { status: 500 }
    )
  }
}
