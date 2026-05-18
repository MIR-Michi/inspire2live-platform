import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendScheduledCommsDigests } from '@/lib/comms-digest'

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const results = await sendScheduledCommsDigests(
      supabase,
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    )

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
