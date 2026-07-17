import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''

  if (!token || !submissionId) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Migration 00166 adds the RPC; generated types are intentionally not required
  // for this public token route.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('remove_guest_conference', {
    p_raw_token: token,
    p_sub_id: submissionId,
  })

  if (error) {
    if (error.message?.includes('invalid_token')) {
      return NextResponse.json({ error: 'This guest link is invalid or expired.' }, { status: 403 })
    }
    if (error.message?.includes('submission_not_found')) {
      return NextResponse.json({ error: 'This conference is no longer on your list.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Could not remove the conference.' }, { status: 500 })
  }

  const result = (data ?? {}) as {
    conferenceId?: string | null
    conferenceName?: string | null
    storagePaths?: string[] | null
  }
  const storagePaths = Array.isArray(result.storagePaths)
    ? result.storagePaths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []

  // Database rows are already removed atomically. Remove the corresponding
  // objects through the supported Storage API as a best-effort cleanup.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey && storagePaths.length > 0) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await admin.storage.from('congress-guest-uploads').remove(storagePaths).catch(() => null)
  }

  return NextResponse.json({
    ok: true,
    conferenceId: result.conferenceId ?? null,
    conferenceName: result.conferenceName ?? null,
  })
}
