import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadConference, loadConferenceTracking } from '@/lib/comms-conferences'
import { loadConferencePrep } from '@/lib/comms-conference-prep'
import { ConferenceOperatingShell } from '@/components/comms/conferences/conference-operating-shell'

// Depends on the current Supabase session; render at request time.
export const dynamic = 'force-dynamic'

export default async function ConferenceOperatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [conference, tracking, prep, { data: profiles }, { data: podcastEvents }, { data: campusSessions }] =
    await Promise.all([
      loadConference(supabase, id),
      loadConferenceTracking(supabase, id),
      loadConferencePrep(supabase, id),
      supabase.from('profiles').select('id, name, email').order('name'),
      supabase.from('events').select('id, name').eq('event_type', 'podcast').order('start_date', { ascending: false }),
      supabase.from('campus_sessions').select('id, theme, session_date').order('session_date', { ascending: false }),
    ])

  if (!conference) notFound()

  const campusOptions = (campusSessions ?? []).map((s) => ({
    id: String(s.id),
    label: (s.theme as string | null) ?? `Session ${String(s.session_date ?? '').slice(0, 10)}`,
  }))

  return (
    <ConferenceOperatingShell
      conference={conference}
      stage={tracking?.stage ?? null}
      notes={tracking?.notes ?? null}
      prep={prep}
      profiles={(profiles ?? []).map((p) => ({ id: p.id, name: p.name, email: p.email }))}
      podcastEvents={(podcastEvents ?? []).map((e) => ({ id: String(e.id), name: String(e.name) }))}
      campusSessions={campusOptions}
    />
  )
}
