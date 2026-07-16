/**
 * POST /api/congress-guest/contribute
 *
 * Public: a magic-link guest writes their on-site contribution directly into
 * the shared conference operating record (`conference_prep`) via the
 * token-scoped `guest_contribute_to_prep` RPC (Sprint 18, T08). Best-effort —
 * the guest's per-submission files/notes are still the primary store, so a
 * failure here never blocks the guest.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const conferenceId = typeof body.conferenceId === 'string' ? body.conferenceId.trim() : ''
  const takeaways = typeof body.takeaways === 'string' ? body.takeaways.trim() : null
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : null
  const deckUrl = typeof body.deckUrl === 'string' ? body.deckUrl.trim() : null
  const hasPresentation = typeof body.hasPresentation === 'boolean' ? body.hasPresentation : null

  if (!token || !conferenceId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('guest_contribute_to_prep', {
    p_raw_token: token,
    p_conference_id: conferenceId,
    p_takeaways: takeaways,
    p_photo_url: photoUrl,
    p_deck_url: deckUrl,
    p_has_presentation: hasPresentation,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 403 })
    }
    if (error.message?.includes('conference_not_linked')) {
      return NextResponse.json({ error: 'Conference not linked to this invite.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Could not save contribution.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
