import Link from 'next/link'
import { isPlatformAdmin } from '@/lib/role-access'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateInitiativeButton } from '@/components/ui/client-buttons'

export default async function InitiativesIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const role = profile?.role ?? 'PatientAdvocate'
  const isCoordinator = role === 'HubCoordinator' || isPlatformAdmin(role)

  const { data: all } = await supabase
    .from('initiative_health')
    .select('id, title, phase, status, member_count, open_tasks, blocked_tasks')
    .order('title')

  let dbRows = all ?? []
  if (!isCoordinator && dbRows.length > 0) {
    const { data: membershipRows } = await supabase
      .from('initiative_members')
      .select('initiative_id')
      .eq('user_id', user.id)
    const memberIds = new Set((membershipRows ?? []).map((m) => m.initiative_id))
    dbRows = dbRows.filter((r) => r.id && memberIds.has(r.id))
  }

  const rows = dbRows

  const phaseColor: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-700',
    research: 'bg-purple-100 text-purple-700',
    execution: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-neutral-100 text-neutral-600',
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Initiatives</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isCoordinator ? 'All initiative workspaces.' : 'Your initiative workspaces.'}
          </p>
        </div>
        <CreateInitiativeButton />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Execution</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{rows.filter(r => r.phase === 'execution').length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Research</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{rows.filter(r => r.phase === 'research').length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Planning</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{rows.filter(r => r.phase === 'planning').length}</p>
        </div>
      </div>

      {/* Initiative cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/app/initiatives/${row.id}`}
            className="group block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-orange-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-orange-700">{row.title}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${phaseColor[row.phase ?? ''] ?? 'bg-neutral-100 text-neutral-600'}`}>
                {row.phase}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
              <span>{row.member_count ?? 0} members</span>
              <span>{row.open_tasks ?? 0} tasks</span>
              {(row.blocked_tasks ?? 0) > 0 && (
                <span className="font-medium text-red-600">{row.blocked_tasks} blocked</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-neutral-900">No visible initiatives</p>
          <p className="mt-1 text-sm text-neutral-500">You can only see initiatives you are invited to. Ask a coordinator/admin to add you.</p>
        </div>
      )}
    </div>
  )
}
