import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { CommsDashboardToggle } from '@/components/comms/comms-dashboard-toggle'
import { CommsDashboardPanel } from '@/components/comms/comms-personal-dashboard'
import { TeamDashboard } from '@/components/comms/team-dashboard'
import { loadCommsPersonalDashboardData } from '@/lib/comms-personal-dashboard-data'
import { loadCommsTeamDashboardData } from '@/lib/comms-dashboard-data'
import type { EventScopeFilter } from '@/lib/comms-event-pipeline'

const VALID_VIEWS = new Set(['personal', 'team'])
const VALID_SCOPES = new Set<EventScopeFilter>(['all', 'i2l', 'networking', 'past'])

export default async function CommsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; scope?: string }>
}) {
  const params = (await searchParams) ?? {}
  const view = VALID_VIEWS.has(params.view ?? '') ? (params.view as 'personal' | 'team') : 'team'
  const scope =
    params.scope && VALID_SCOPES.has(params.scope as EventScopeFilter)
      ? (params.scope as EventScopeFilter)
      : 'all'

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
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Communications dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view === 'team'
              ? 'Shared common ground — channels, events, agenda, and team activity.'
              : 'Your personal deadlines, content, and signals.'}
          </p>
        </div>
        <CommsDashboardToggle view={view} />
      </div>

      {view === 'personal' ? (
        <CommsDashboardPanel name={profile?.name} {...(await loadCommsPersonalDashboardData(supabase, user.id))} />
      ) : (
        <TeamDashboard data={await loadCommsTeamDashboardData(supabase, { scopeFilter: scope })} />
      )}
    </div>
  )
}
