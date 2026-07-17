import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardConfig } from '@/lib/dashboard-config'
import { buildDashboardGreeting, resolveDashboardVariant } from '@/lib/dashboard-view'
import { getViewAsRole, resolveEffectiveViewer } from '@/lib/view-as'
import { normalizeRole, isPlatformAdmin, isSuperadmin } from '@/lib/role-access'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { AdminDashboardToggle } from '@/components/admin/admin-dashboard-toggle'
import { loadAdminDashboardData } from '@/lib/admin-dashboard-data'
import {
  AdvocateDashboard,
  BoardDashboard,
  CoordinatorDashboard,
  type DashboardNewsItem,
  type InitiativeHealth,
  type InitiativeTaskRow,
  type MemberActivity,
} from '@/components/dashboard/role-dashboards'
import {
  buildDefaultDashboardLayout,
  getDashboardDefinition,
  loadDashboardLayout,
  resolveDashboardDesignConfig,
  type DashboardId,
  type DashboardLayoutState,
} from '@/kernel/dashboard'

async function resolveLayout({
  supabase,
  userId,
  dashboardId,
  previewingUser,
  roleOnlyPreview,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  dashboardId: DashboardId
  previewingUser: boolean
  roleOnlyPreview: boolean
}): Promise<DashboardLayoutState> {
  const design = await resolveDashboardDesignConfig(supabase as unknown as SupabaseClient)
  const definition = getDashboardDefinition(dashboardId)
  const defaults = { preset: design.defaultPreset, splitRatio: design.defaultSplitRatio, density: design.density }
  if (roleOnlyPreview) return buildDefaultDashboardLayout(definition, defaults)
  const client = previewingUser ? createAdminClient() as unknown as SupabaseClient : supabase as unknown as SupabaseClient
  return (await loadDashboardLayout(client, userId, definition, defaults)).layout
}

async function loadNewsfeed(supabase: Awaited<ReturnType<typeof createClient>>): Promise<DashboardNewsItem[]> {
  const newsDb = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => Promise<{ data: Array<Record<string, unknown>> | null }>
          }
        }
      }
    }
  }
  const { data } = await newsDb
    .from('news_feed_items')
    .select('id, headline, summary, category, region, source_url, source_name, published_at, created_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(8)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    category: String(row.category ?? 'other'),
    headline: String(row.headline ?? ''),
    summary: String(row.summary ?? ''),
    source: String(row.source_name ?? ''),
    sourceUrl: String(row.source_url ?? ''),
    region: String(row.region ?? ''),
    published: String(row.published_at ?? row.created_at ?? new Date().toISOString()),
  }))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()
  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const actualRole = profile?.role ?? 'PatientAdvocate'
  const viewer = await resolveEffectiveViewer(supabase)
  const roleOnlyPreviewValue = isSuperadmin(actualRole) && !viewer?.isPreviewing ? await getViewAsRole() : null
  const role = viewer?.isPreviewing ? normalizeRole(viewer.role) : roleOnlyPreviewValue ?? actualRole
  const effectiveUserId = viewer?.userId ?? user.id
  const effectiveName = viewer?.name ?? profile?.name
  const readOnly = Boolean(viewer?.isPreviewing || roleOnlyPreviewValue)

  if (role === 'Comms') redirect('/app/comms/dashboard')

  if (isPlatformAdmin(role)) {
    const [adminData, layout] = await Promise.all([
      loadAdminDashboardData(supabase, user.id),
      resolveLayout({ supabase, userId: user.id, dashboardId: 'admin', previewingUser: false, roleOnlyPreview: false }),
    ])
    const greeting = buildDashboardGreeting(profile?.name)
    return (
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Platform</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Admin dashboard</h1>
            <p className="mt-1 text-sm text-neutral-500">{greeting} Platform health and what needs your attention.</p>
          </div>
          <AdminDashboardToggle active="admin" />
        </div>
        <AdminDashboard data={adminData} initialLayout={layout} />
      </div>
    )
  }

  const dashboardConfig = getDashboardConfig(role)
  const dashboardVariant = resolveDashboardVariant(role)
  const isCoordinator = dashboardVariant === 'coordinator'
  const isBoard = dashboardVariant === 'board'
  const dashboardId: DashboardId = isCoordinator ? 'coordinator' : isBoard ? 'board' : 'advocate'

  const { data: initiativeRows } = await supabase.from('initiative_health').select('*').order('title')
  const initiatives = (initiativeRows ?? []) as InitiativeHealth[]

  let inactiveMembers: MemberActivity[] = []
  if (isCoordinator) {
    const { data } = await supabase
      .from('member_activity_summary')
      .select('*')
      .gt('days_since_activity', 14)
      .eq('onboarding_completed', true)
      .order('days_since_activity', { ascending: false })
      .limit(10)
    inactiveMembers = (data ?? []) as MemberActivity[]
  }

  let myInitiatives: InitiativeHealth[] = []
  let myTasks: InitiativeTaskRow[] = []
  if (!isCoordinator && !isBoard) {
    const { data: memberRows } = await supabase
      .from('initiative_members')
      .select('initiative_id')
      .eq('user_id', effectiveUserId)
    const memberIds = memberRows?.map((row) => row.initiative_id) ?? []
    myInitiatives = initiatives.filter((initiative) => initiative.id && memberIds.includes(initiative.id))

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, initiative_id')
      .eq('assignee_id', effectiveUserId)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
    myTasks = (taskRows ?? []) as InitiativeTaskRow[]
  }

  const [newsfeed, layout] = await Promise.all([
    loadNewsfeed(supabase),
    resolveLayout({
      supabase,
      userId: effectiveUserId,
      dashboardId,
      previewingUser: Boolean(viewer?.isPreviewing),
      roleOnlyPreview: Boolean(roleOnlyPreviewValue),
    }),
  ])
  const greeting = buildDashboardGreeting(effectiveName)

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Your workspace</p>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{dashboardConfig.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{greeting} {dashboardConfig.subtitle}</p>
      </div>

      {isCoordinator && (
        <CoordinatorDashboard initiatives={initiatives} inactive={inactiveMembers} newsfeed={newsfeed} initialLayout={layout} readOnly={readOnly} />
      )}
      {isBoard && <BoardDashboard initiatives={initiatives} newsfeed={newsfeed} initialLayout={layout} readOnly={readOnly} />}
      {!isCoordinator && !isBoard && (
        <AdvocateDashboard initiatives={myInitiatives} tasks={myTasks} newsfeed={newsfeed} initialLayout={layout} readOnly={readOnly} />
      )}
    </div>
  )
}
