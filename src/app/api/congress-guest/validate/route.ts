/**
 * GET /api/congress-guest/validate?token=<raw>
 *
 * Public: validates a guest magic-link token and returns prefill data.
 * Uses the validate_conference_guest_token SECURITY DEFINER RPC
 * (anon role) so no platform tables are directly readable.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = (searchParams.get('token') ?? '').trim()

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ valid: false }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('validate_conference_guest_token', {
    raw_token: token,
  })

  if (error) {
    console.error('[congress-guest/validate] RPC error', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ valid: false })
  }

  const row = data[0]
  return NextResponse.json({
    valid: true,
    tokenId: row.token_id,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    conferenceId: row.conference_id ?? null,
    conferenceName: row.conference_name ?? null,
  })
}
