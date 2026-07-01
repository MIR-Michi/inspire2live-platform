/**
 * POST /api/congress-guest/submit
 *
 * Public: submits a conference attendance form via a guest magic-link token.
 * Calls the submit_conference_guest_form SECURITY DEFINER RPC which validates
 * the token and inserts into the staging table atomically.
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
  const submitterName = typeof body.submitterName === 'string' ? body.submitterName.trim() : ''
  const conferenceName = typeof body.conferenceName === 'string' ? body.conferenceName.trim() : ''

  if (!token || !submitterName || !conferenceName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('submit_conference_guest_form', {
    p_raw_token: token,
    p_submitter_name: submitterName,
    p_submitter_email: (body.submitterEmail as string | null) ?? null,
    p_submitter_phone: (body.submitterPhone as string | null) ?? null,
    p_submitter_org: (body.submitterOrg as string | null) ?? null,
    p_conference_id: (body.conferenceId as string | null) ?? null,
    p_conference_name: conferenceName,
    p_conference_start: (body.conferenceStart as string | null) ?? null,
    p_conference_end: (body.conferenceEnd as string | null) ?? null,
    p_conference_location: (body.conferenceLocation as string | null) ?? null,
    p_role: (body.role as string | null) ?? 'attendee',
    p_notes: (body.notes as string | null) ?? null,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 403 })
    }
    console.error('[congress-guest/submit] RPC error', error)
    return NextResponse.json({ error: 'Could not save your submission.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, submissionId: data })
}
