import Link from 'next/link'
import { notFound } from 'next/navigation'
import { saveCampusSession, addCampusSessionFile, deleteCampusSessionFile } from '@/app/app/comms/campus-log/actions'
import { triggerSessionTeamsStub } from '@/app/app/comms/integration-actions'
import { IntegrationStubForm } from '@/components/comms/integration-stub-form'
import { MeetingTranscriptPanel } from '@/components/comms/meeting-transcript-panel'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import { loadCampusSessionTranscript } from '@/lib/comms-meeting-transcripts'
import { loadCommsTeamMembers } from '@/lib/comms-dashboard-data'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { createClient } from '@/lib/supabase/server'

const CAMPUS_SESSION_DETAIL_SELECT =
  'id, session_date, theme, summary, decisions_for_publication, action_items_for_publication, recording_url, slides_media_id, participating_hub_ids, initiative_ids, published_outputs'

const FILE_ASSET_TYPES = ['slides', 'document', 'recording', 'photo', 'video', 'report'] as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export default async function CampusSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('campus_sessions')
    .select(CAMPUS_SESSION_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (!session) notFound()

  const [{ data: hubs }, { data: initiatives }, { data: contentEntries }, { data: sessionFiles }] = await Promise.all([
    supabase.from('hubs').select('id, name').order('name'),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase.from('content_calendar').select('id, title, status').order('title'),
    supabase.from('media_assets').select('id, title, asset_type, sharepoint_url').eq('session_id', session.id).order('created_at', { ascending: true }),
  ])

  const [transcript, teamMembers] = await Promise.all([
    loadCampusSessionTranscript(supabase, session.id),
    loadCommsTeamMembers(supabase),
  ])
  const transcriptOwners = teamMembers.map((member) => ({ id: member.id, label: member.label }))

  const hubSet = new Set(session.participating_hub_ids ?? [])
  const initiativeSet = new Set(session.initiative_ids ?? [])
  const outputSet = new Set(session.published_outputs ?? [])
  const stubFlags = getIntegrationStubFlags()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/app/comms/campus-log?tab=sessions" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800">
        ← Back to campus sessions
      </Link>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">World Campus session</p>
        <h1 className="text-3xl font-semibold text-neutral-900">{session.theme || 'Untitled session'}</h1>
        <p className="text-sm text-neutral-500">{formatDate(session.session_date)}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Meeting transcript &amp; AI summary</h2>
        <MeetingTranscriptPanel
          context={{ kind: 'campus', campusSessionId: session.id }}
          transcript={transcript}
          owners={transcriptOwners}
          aiEnabled={isAiEnabled()}
        />
      </section>

      <form action={saveCampusSession} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="session_id" value={session.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Session date</span>
            <input type="date" name="session_date" defaultValue={session.session_date} required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Theme</span>
            <input name="theme" defaultValue={session.theme ?? ''} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Summary</span>
          <textarea name="summary" rows={6} defaultValue={session.summary ?? ''} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Decisions for publication</span>
          <textarea
            name="decisions_for_publication"
            rows={5}
            defaultValue={(session.decisions_for_publication ?? []).join('\n')}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Action items for publication</span>
          <textarea
            name="action_items_for_publication"
            rows={5}
            defaultValue={(session.action_items_for_publication ?? []).join('\n')}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Recording URL</span>
          <input type="url" name="recording_url" defaultValue={session.recording_url ?? ''} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </label>

        {stubFlags.teams && (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-900">Teams meeting stub</p>
            <p className="mt-1 text-sm text-neutral-500">
              Phase 1 keeps Teams as a logged intent only. Phase 2 swaps this for a real connector.
            </p>
            <div className="mt-3">
              <IntegrationStubForm
                action={triggerSessionTeamsStub}
                entityId={session.id}
                buttonLabel="Log Teams meeting intent"
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
              />
            </div>
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-800">Participating hubs</legend>
          <div className="grid gap-2 md:grid-cols-3">
            {(hubs ?? []).map((hub) => (
              <label key={hub.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                <input type="checkbox" name="participating_hub_ids" value={hub.id} defaultChecked={hubSet.has(hub.id)} />
                {hub.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-800">Initiative connections</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {(initiatives ?? []).map((initiative) => (
              <label key={initiative.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                <input type="checkbox" name="initiative_ids" value={initiative.id} defaultChecked={initiativeSet.has(initiative.id)} />
                {initiative.title}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-800">Published outputs</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {(contentEntries ?? []).map((entry) => (
              <label key={entry.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                <input type="checkbox" name="published_outputs" value={entry.id} defaultChecked={outputSet.has(entry.id)} />
                <span>
                  {entry.title}
                  <span className="ml-1 text-xs text-neutral-500">({entry.status})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button type="submit" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Save session
          </button>
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Session files</h2>

        {(sessionFiles ?? []).length > 0 ? (
          <ul className="space-y-2">
            {(sessionFiles ?? []).map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-800">{file.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">{file.asset_type}</span>
                    {file.sharepoint_url && (
                      <a href={file.sharepoint_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-orange-700 hover:underline">
                        Open ↗
                      </a>
                    )}
                  </p>
                </div>
                <form action={deleteCampusSessionFile}>
                  <input type="hidden" name="file_id" value={file.id} />
                  <input type="hidden" name="session_id" value={session.id} />
                  <button type="submit" className="shrink-0 text-xs font-semibold text-neutral-400 hover:text-red-600">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No files attached yet.</p>
        )}

        <form action={addCampusSessionFile} className="space-y-3 rounded-xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-4">
          <input type="hidden" name="session_id" value={session.id} />
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add file</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="title" required placeholder="Title (e.g. Slides June 2026)" className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none" />
            <select name="asset_type" className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none">
              {FILE_ASSET_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <input name="url" required type="url" placeholder="SharePoint or external URL" className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none sm:col-span-2" />
          </div>
          <button type="submit" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Attach file
          </button>
        </form>
      </section>
    </div>
  )
}
