/**
 * POST /api/congress-guest/upload/delete
 *
 * Public: deletes a guest file the token owns. Removes the DB row via the
 * anon RPC (which returns the storage path) and then deletes the storage
 * object via the service role.
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
  const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : ''

  if (!token || !fileId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, anonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: storagePath, error } = await (supabase as any).rpc('delete_guest_file', {
    p_raw_token: token,
    p_file_id: fileId,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'Invalid link.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Could not delete file.' }, { status: 500 })
  }

  // Best-effort storage cleanup (row is already gone).
  if (serviceKey && typeof storagePath === 'string' && storagePath) {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await admin.storage.from('congress-guest-uploads').remove([storagePath]).catch(() => {/* best-effort */})
  }

  return NextResponse.json({ ok: true })
}
