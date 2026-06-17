import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { loadCommsAgendaGroups } from '@/lib/comms-dashboard-data'
import { WeeklyAgenda } from '@/components/comms/weekly-agenda'

export default async function CommsMeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) redirect('/app/dashboard')

  const groups = await loadCommsAgendaGroups(supabase)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Weekly meetings</h1>
        <Link href="/app/comms/dashboard?view=team" className="text-sm font-medium text-orange-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
      <WeeklyAgenda groups={groups} />
    </div>
  )
}
