import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  getDashboardDefinition,
  isDashboardId,
  loadDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  validateDashboardLayout,
} from '@/kernel/dashboard'

async function authenticatedClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase: supabase as unknown as SupabaseClient, user }
}

function dashboardIdFrom(request: Request): string | null {
  return new URL(request.url).searchParams.get('dashboardId')
}

export async function GET(request: Request) {
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const dashboardId = dashboardIdFrom(request)
  if (!dashboardId || !isDashboardId(dashboardId)) {
    return NextResponse.json({ error: 'Unknown dashboard.' }, { status: 400 })
  }

  const preference = await loadDashboardLayout(supabase, user.id, getDashboardDefinition(dashboardId))
  return NextResponse.json(preference)
}

export async function PUT(request: Request) {
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const dashboardId = Reflect.get(body, 'dashboardId')
  const layout = Reflect.get(body, 'layout')
  if (typeof dashboardId !== 'string' || !isDashboardId(dashboardId)) {
    return NextResponse.json({ error: 'Unknown dashboard.' }, { status: 400 })
  }

  const definition = getDashboardDefinition(dashboardId)
  const validated = validateDashboardLayout(definition, layout)
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })

  const result = await saveDashboardLayout(supabase, user.id, definition, validated.layout)
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: result.error }, { status: 500 })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authenticatedClient()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const dashboardId = dashboardIdFrom(request)
  if (!dashboardId || !isDashboardId(dashboardId)) {
    return NextResponse.json({ error: 'Unknown dashboard.' }, { status: 400 })
  }

  const result = await resetDashboardLayout(supabase, user.id, getDashboardDefinition(dashboardId))
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: result.error }, { status: 500 })
}
