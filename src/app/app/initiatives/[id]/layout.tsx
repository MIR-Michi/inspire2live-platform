import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { InitiativeTabs } from '@/components/initiatives/initiative-tabs'
import { canManageInitiativeWorkspace } from '@/lib/initiative-workspace'
import { normalizeStage, STAGE_META } from '@/lib/initiative-stages'

export default async function InitiativeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, title, status, phase')
    .eq('id', id)
    .maybeSingle()

  if (!initiative) redirect('/app/initiatives')

  const stage = normalizeStage(initiative.phase)
  const stageMeta = STAGE_META[stage]

  const { data: membership } = await supabase
    .from('initiative_members')
    .select('role')
    .eq('initiative_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isCoordinator = profile?.role === 'HubCoordinator' || profile?.role === 'PlatformAdmin'
  if (!membership && !isCoordinator) redirect('/app/initiatives')

  const canManage = canManageInitiativeWorkspace(profile?.role, membership?.role)

  const tabs = [
    { label: 'Overview', href: `/app/initiatives/${id}` },
    { label: 'Milestones', href: `/app/initiatives/${id}/milestones` },
    { label: 'Tasks', href: `/app/initiatives/${id}/tasks` },
    { label: 'Evidence', href: `/app/initiatives/${id}/evidence` },
    { label: 'Team', href: `/app/initiatives/${id}/team` },
    { label: 'Communication', href: `/app/initiatives/${id}/discussions` },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{initiative.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stageMeta.color}`}>
                {stageMeta.label}
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-600">
                {initiative.status}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/initiatives"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              All initiatives
            </Link>
            {canManage ? (
              <Link
                href={`/app/initiatives/${id}/tasks`}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                Manage tasks
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <InitiativeTabs tabs={tabs} />
      {children}
    </div>
  )
}

