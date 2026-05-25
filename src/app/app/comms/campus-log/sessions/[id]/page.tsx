import Link from 'next/link'
import { notFound } from 'next/navigation'
import { saveCampusSession } from '@/app/app/comms/campus-log/actions'
import { triggerSessionTeamsStub } from '@/app/app/comms/integration-actions'
import { IntegrationStubForm } from '@/components/comms/integration-stub-form'
import { getIntegrationStubFlags } from '@/lib/comms-integrations'
import { createClient } from '@/lib/supabase/server'

const CAMPUS_SESSION_DETAIL_SELECT =
  'id, session_date, theme, summary, decisions_for_publication, action_items_for_publication, recording_url, slides_media_id, participating_hub_ids, initiative_ids, published_outputs'

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

  const [{ data: hubs }, { data: initiatives }, { data: contentEntries }, { data: slidesAsset }] = await Promise.all([
    supabase.from('hubs').select('id, name').order('name'),
    supabase.from('initiatives').select('id, title').order('title'),
    supabase.from('content_calendar').select('id, title, status').order('title'),
    session.slides_media_id
      ? supabase.from('media_assets').select('id, title').eq('id', session.slides_media_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Recording URL</span>
            <input type="url" name="recording_url" defaultValue={session.recording_url ?? ''} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Slides reference (media asset ID)</span>
            <input name="slides_media_id" defaultValue={session.slides_media_id ?? ''} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
            {slidesAsset && <span className="text-xs text-neutral-500">Current slide asset: {slidesAsset.title}</span>}
          </label>
        </div>

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
    </div>
  )
}
