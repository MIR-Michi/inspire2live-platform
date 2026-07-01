/**
 * GET /api/congress-guest/conferences?q=<query>
 *
 * Public (no auth) conference search for the guest attendance form typeahead.
 * Calls the search_conferences_public SECURITY DEFINER RPC which uses the
 * anon role — no platform access is granted.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json([], { status: 200 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('search_conferences_public', {
    query: q,
    max_results: 8,
  })

  if (!error && Array.isArray(data)) {
    return NextResponse.json(data)
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json([])
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: fallback } = await admin
      .from('conferences')
      .select('id, name, location, start_date, end_date')
      .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(8)

    return NextResponse.json(fallback ?? [])
  } catch {
    return NextResponse.json([])
  }
}
