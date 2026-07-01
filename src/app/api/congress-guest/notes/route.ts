/**
 * POST /api/congress-guest/notes
 *
 * Public: saves a meeting summary or comment for a guest submission.
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
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const noteType = typeof body.noteType === 'string' ? body.noteType : 'summary'
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!token || !submissionId || !content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('add_guest_note', {
    p_raw_token: token,
    p_sub_id: submissionId,
    p_note_type: noteType,
    p_content: content,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Could not save note.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, noteId: data })
}
