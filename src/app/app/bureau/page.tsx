import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

type InitiativeHealth = Tables<'initiative_health'>

function computeRag(i: InitiativeHealth): 'green' | 'amber' | 'red' {
  const overdue = i.overdue_milestones ?? 0
  const blocked = i.blocked_tasks ?? 0
  const approaching = i.approaching_milestones ?? 0
  const daysSince = i.last_activity_at ? Math.floor((Date.now() - new Date(i.last_activity_at).getTime()) / 86400000) : 999
  if (overdue > 0 || blocked >= 3 || daysSince > 14) return 'red'
  if (approaching > 0 || blocked > 0) return 'amber'
  return 'green'
}

const ragStyles = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500' }
const ragLabel = { green: 'On track', amber: 'Needs attention', red: 'At risk' }

export default async function BureauPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: dbInits } = await supabase.from('initiative_health').select('*').order('title')
  const initiatives: InitiativeHealth[] = dbInits ?? []

  const green = initiatives.filter(i => computeRag(i) === 'green').length
  const amber = initiatives.filter(i => computeRag(i) === 'amber').length
  const red = initiatives.filter(i => computeRag(i) === 'red').length
  const totalMembers = initiatives.reduce((s, i) => s + (i.member_count ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Bureau</h1>
        <p className="mt-1 text-sm text-neutral-500">Monitor all initiative health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Initiatives</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">{initiatives.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">On Track</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{green}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Attention</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{amber}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Contributors</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">{totalMembers}</p>
        </div>
      </div>

      {red > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {red} initiative{red > 1 ? 's are' : ' is'} at risk and may require immediate attention.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 text-left">Initiative</th>
              <th className="px-4 py-3 text-left">Phase</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Tasks</th>
              <th className="px-4 py-3 text-right">Blocked</th>
              <th className="px-4 py-3 text-right">Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {initiatives.map((i) => {
              const rag = computeRag(i)
              return (
                <tr key={i.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/app/initiatives/${i.id}`} className="font-medium text-neutral-900 hover:text-orange-700">{i.title}</Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">{i.phase}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-2 w-2 rounded-full ${ragStyles[rag]}`} />
                      {ragLabel[rag]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700">{i.open_tasks ?? 0}</td>
                  <td className="px-4 py-3 text-right"><span className={(i.blocked_tasks ?? 0) > 0 ? 'font-semibold text-red-600' : 'text-neutral-500'}>{i.blocked_tasks ?? 0}</span></td>
                  <td className="px-4 py-3 text-right text-neutral-700">{i.member_count ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
