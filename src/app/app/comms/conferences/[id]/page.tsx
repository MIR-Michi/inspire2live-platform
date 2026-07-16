import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadConference, loadConferenceTracking, loadConferenceAssignedContacts } from '@/lib/comms-conferences'
import { loadConferencePrep } from '@/lib/comms-conference-prep'
import { loadConferenceGuestReports } from '@/lib/comms-conference-guest-reports'
import { loadConferenceInvites } from '@/lib/comms-conference-invites'
import { loadConferenceTasks } from '@/app/app/comms/conferences/actions'
import { ConferenceOperatingShell } from '@/components/comms/conferences/conference-operating-shell'
import { ConferenceParticipationPanel } from '@/modules/events/ui/conferences/conference-participation-panel'

// Depends on the current Supabase session; render at request time.
export const dynamic = 'force-dynamic'

export default async function ConferenceOperatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [conference, tracking, prep, { data: profiles }, { data: podcastEvents }, { data: campusSessions }, assignedContacts, tasks, guestReports, invites] =
    await Promise.all([
      loadConference(supabase, id),
      loadConferenceTracking(supabase, id),
      loadConferencePrep(supabase, id),
      supabase.from('profiles').select('id, name, email').order('name'),
      supabase.from('events').select('id, name').eq('event_type', 'podcast').order('start_date', { ascending: false }),
      supabase.from('campus_sessions').select('id, theme, session_date').order('session_date', { ascending: false }),
      loadConferenceAssignedContacts(supabase, id),
      loadConferenceTasks(id),
      loadConferenceGuestReports(supabase, id),
      loadConferenceInvites(supabase, id),
    ])

  if (!conference) notFound()

  // Best-effort date-based stage update. The operating page must render even if
  // the RPC is unavailable, not yet migrated, or rejected by RLS.
  if (tracking?.stage && tracking.stage !== 'archived') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('auto_advance_conference_stage', { p_conference_id: id })
    } catch (error) {
      console.error('[conferences] auto_advance_conference_stage failed', error)
    }
  }

  const campusOptions = (campusSessions ?? []).map((s) => ({
    id: String(s.id),
    label: (s.theme as string | null) ?? `Session ${String(s.session_date ?? '').slice(0, 10)}`,
  }))

  return (
    <div className="mx-auto max-w-7xl xl:grid xl:grid-cols-[minmax(0,48rem)_20rem] xl:items-start xl:gap-6">
      <ConferenceOperatingShell
        conference={conference}
        stage={tracking?.stage ?? null}
        notes={tracking?.notes ?? null}
        prep={prep}
        profiles={(profiles ?? []).map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        podcastEvents={(podcastEvents ?? []).map((e) => ({ id: String(e.id), name: String(e.name) }))}
        campusSessions={campusOptions}
        assignedContacts={assignedContacts}
        initialTasks={tasks}
        guestReports={guestReports}
        invites={invites}
      />
      <ConferenceParticipationPanel
        conferenceName={conference.name}
        assignedContacts={assignedContacts}
        guestReports={guestReports}
        teamPhotoUrls={prep.photoUrls}
      />
    </div>
  )
}
