import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Telemetry ingest for user-activity events (pageview / heartbeat). Best-effort:
 * authentication is required, but any other failure (e.g. the table not existing
 * before migration 00106 is applied) is swallowed so tracking never disrupts the
 * app. The user_id is taken from the session, never the request body.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { kind?: unknown; space?: unknown; path?: unknown }
      | null
    if (!body) return new NextResponse(null, { status: 400 })

    const kind = body.kind === 'heartbeat' ? 'heartbeat' : body.kind === 'pageview' ? 'pageview' : null
    if (!kind) return new NextResponse(null, { status: 400 })

    const space = typeof body.space === 'string' && body.space.trim() ? body.space.trim().slice(0, 80) : 'Other'
    const path = typeof body.path === 'string' ? body.path.slice(0, 300) : null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse(null, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('user_activity_events').insert({ user_id: user.id, kind, space, path })
    return new NextResponse(null, { status: 204 })
  } catch {
    // Telemetry must never surface errors to the client.
    return new NextResponse(null, { status: 204 })
  }
}
