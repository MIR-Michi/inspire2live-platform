/**
 * GET /api/congress-guest/workspace?token=<raw>
 *
 * Public: returns the guest workspace data for a token (submissions, files, notes).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.includes('@') ? email : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = (searchParams.get('token') ?? '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_guest_workspace', {
    raw_token: token,
  })

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or expired' }, { status: 404 })
  }

  const workspace = data as {
    token?: { contactEmail?: string | null }
    submissions?: Array<{ submitterEmail?: string | null }>
  }
  const contactEmail = normalizeEmail(workspace.token?.contactEmail)
    ?? normalizeEmail(workspace.submissions?.[0]?.submitterEmail)
  let hasPlatformAccess = false

  if (contactEmail && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', contactEmail)
        .maybeSingle()
      hasPlatformAccess = Boolean(profile?.id)
    } catch {
      hasPlatformAccess = false
    }
  }

  return NextResponse.json({
    ...(data as Record<string, unknown>),
    token: {
      ...((data as { token?: Record<string, unknown> }).token ?? {}),
      hasPlatformAccess,
    },
  })
}
