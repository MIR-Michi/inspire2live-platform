import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { resolveEffectiveViewer } from '@/lib/view-as'
import { isPlatformAdmin } from '@/lib/role-access'
import { CommsDashboardToggle } from '@/components/comms/comms-dashboard-toggle'
import { CommsDashboardPanel } from '@/components/comms/comms-personal-dashboard'
import { TeamDashboard } from '@/components/comms/team-dashboard'
import { loadCommsPersonalDashboardData } from '@/lib/comms-personal-dashboard-data'
import { loadCommsTeamDashboardData } from '@/lib/comms-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRunStatus } from '@/lib/ai/org-newsfeed-run'
import {
  getDashboardDefinition,
  loadDashboardLayout,
  resolveDashboardDesignConfig,
  type DashboardId,
} from '@/kernel/dashboard'

export const maxDuration = 300

const VALID_VIEWS = new Set(['personal', 'team'])

async function loadNewsfeedRunStatus() {
  try {
    return await getRunStatus(createAdminClient())
  } catch {
    return null
  }
}

export default async function CommsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>
}) {
  const params = (await searchParams) ?? {}
  const view = VALID_VIEWS.has(params.view ?? '') ? (params.view as 'personal' | 'team') : 'team'
  const dashboardId: DashboardId = view === 'personal' ? 'comms-personal' : 'comms-team'

  const supabase = await createClient()
  const viewer = await resolveEffectiveViewer(supabase)
  if (!viewer) redirect('/login')
  if (!canAccessCommsWorkspace(viewer.role)) redirect('/app/dashboard')

  const design = await resolveDashboardDesignConfig(supabase as unknown as SupabaseClient)
  const preferenceClient = viewer.isPreviewing
    ? createAdminClient() as unknown as SupabaseClient
    : supabase as unknown as SupabaseClient
  const { layout } = await loadDashboardLayout(
    preferenceClient,
    viewer.userId,
    getDashboardDefinition(dashboardId),
    { preset: design.defaultPreset, splitRatio: design.defaultSplitRatio, density: design.density },
  )

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Communications</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">Dashboard</h1>
        </div>
        <CommsDashboardToggle view={view} showAdmin={isPlatformAdmin(viewer.role)} />
      </div>

      {view === 'personal' ? (
        <CommsDashboardPanel
          name={viewer.name}
          {...(await loadCommsPersonalDashboardData(supabase, viewer.userId))}
          initialLayout={layout}
          readOnly={viewer.isPreviewing}
        />
      ) : (
        <TeamDashboard
          data={await loadCommsTeamDashboardData(supabase)}
          initialLayout={layout}
          readOnly={viewer.isPreviewing}
          canApprove={isPlatformAdmin(viewer.role)}
          newsfeedRunStatus={await loadNewsfeedRunStatus()}
        />
      )}
    </div>
  )
}
