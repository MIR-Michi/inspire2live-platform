/**
 * POST /api/congress-guest/notes/delete
 *
 * Public: deletes a guest note (summary or comment) the token owns.
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
  const noteId = typeof body.noteId === 'string' ? body.noteId.trim() : ''

  if (!token || !noteId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('delete_guest_note', {
    p_raw_token: token,
    p_note_id: noteId,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Could not delete note.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
