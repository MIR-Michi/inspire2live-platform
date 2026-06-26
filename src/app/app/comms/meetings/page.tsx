import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { loadCommsAgendaGroups, loadCommsTeamMembers } from '@/lib/comms-dashboard-data'
import { loadMeetingTranscriptsByDate } from '@/lib/comms-meeting-transcripts'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { WeeklyAgenda } from '@/components/comms/weekly-agenda'

export default async function CommsMeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) redirect('/app/dashboard')

  const [groups, ownerOptions] = await Promise.all([
    loadCommsAgendaGroups(supabase),
    loadCommsTeamMembers(supabase),
  ])

  const transcriptsMap = await loadMeetingTranscriptsByDate(supabase, groups.map((g) => g.meetingDate))
  const transcriptsByDate = Object.fromEntries(transcriptsMap)
  const transcriptOwners = ownerOptions.map((member) => ({ id: member.id, label: member.label }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Weekly meetings</h1>
        <div className="flex items-center gap-4">
          <Link href="/app/comms/transcripts" className="text-sm font-medium text-orange-600 hover:underline">
            All transcripts →
          </Link>
          <Link href="/app/comms/dashboard?view=team" className="text-sm font-medium text-orange-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        Expand a meeting to upload its transcript and generate an AI summary with follow-up tasks.
      </p>
      <WeeklyAgenda
        groups={groups}
        ownerOptions={ownerOptions}
        transcriptsByDate={transcriptsByDate}
        transcriptOwners={transcriptOwners}
        aiEnabled={isAiEnabled()}
      />
    </div>
  )
}
