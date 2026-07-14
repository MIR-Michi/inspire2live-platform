import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { resolveEffectiveViewer } from '@/lib/view-as'
import { normalizeRole } from '@/lib/role-access'
import { CommsDashboardToggle } from '@/components/comms/comms-dashboard-toggle'
import { CommsDashboardPanel } from '@/components/comms/comms-personal-dashboard'
import { TeamDashboard } from '@/components/comms/team-dashboard'
import { loadCommsPersonalDashboardData } from '@/lib/comms-personal-dashboard-data'
import { loadCommsTeamDashboardData } from '@/lib/comms-dashboard-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRunStatus } from '@/lib/ai/org-newsfeed-run'

// The "Refresh now" server action runs the web-search newsfeed job inline.
export const maxDuration = 300

const VALID_VIEWS = new Set(['personal', 'team'])

/**
 * Best-effort newsfeed run status. Fully guarded: `createAdminClient()` throws
 * synchronously when `SUPABASE_SERVICE_ROLE_KEY` isn't set (e.g. preview
 * environments), and a bare `.catch()` on the argument can't catch that — a
 * missing key would otherwise crash the whole dashboard render. This widget is
 * non-critical, so any failure degrades to `null`.
 */
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

  const supabase = await createClient()

  // Resolve the effective viewer so an admin previewing another user (view-as)
  // sees that user's dashboard, not their own. Only admins can ever preview;
  // otherwise this is the logged-in user.
  const viewer = await resolveEffectiveViewer(supabase)
  if (!viewer) redirect('/login')

  if (!canAccessCommsWorkspace(viewer.role)) {
    redirect('/app/dashboard')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Communications dashboard</h1>
        <CommsDashboardToggle view={view} />
      </div>

      {view === 'personal' ? (
        <CommsDashboardPanel name={viewer.name} {...(await loadCommsPersonalDashboardData(supabase, viewer.userId))} />
      ) : (
        <TeamDashboard
          data={await loadCommsTeamDashboardData(supabase, { viewerId: viewer.userId })}
          canApprove={normalizeRole(viewer.role) === 'PlatformAdmin'}
          newsfeedRunStatus={await loadNewsfeedRunStatus()}
        />
      )}
    </div>
  )
}