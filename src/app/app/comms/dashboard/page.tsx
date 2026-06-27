import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
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

export default async function CommsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>
}) {
  const params = (await searchParams) ?? {}
  const view = VALID_VIEWS.has(params.view ?? '') ? (params.view as 'personal' | 'team') : 'team'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!canAccessCommsWorkspace(profile?.role)) {
    redirect('/app/dashboard')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Communications dashboard</h1>
        <CommsDashboardToggle view={view} />
      </div>

      {view === 'personal' ? (
        <CommsDashboardPanel name={profile?.name} {...(await loadCommsPersonalDashboardData(supabase, user.id))} />
      ) : (
        <TeamDashboard
          data={await loadCommsTeamDashboardData(supabase)}
          canApprove={profile?.role === 'PlatformAdmin'}
          newsfeedRunStatus={await getRunStatus(createAdminClient()).catch(() => null)}
        />
      )}
    </div>
  )
}