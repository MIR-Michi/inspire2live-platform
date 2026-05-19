import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RightsStatusBadge } from '@/components/comms/rights-status-badge'
import { MEDIA_ASSET_TYPE_META, type MediaAssetType } from '@/lib/comms-media'
import { createClient } from '@/lib/supabase/server'

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  )
}

export default async function MediaAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: asset } = await supabase
    .from('media_assets')
    .select(
      'id, title, asset_type, event_id, session_id, initiative_id, contributed_by, sharepoint_url, tags, rights_status, usage_count, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (!asset) notFound()

  const [{ data: event }, { data: session }, { data: initiative }, { data: contributor }, { data: linkedEntries }, { data: linkedRecovery }] =
    await Promise.all([
      asset.event_id
        ? supabase.from('events').select('id, name').eq('id', asset.event_id).maybeSingle()
        : Promise.resolve({ data: null }),
      asset.session_id
        ? supabase.from('campus_sessions').select('id, theme, session_date').eq('id', asset.session_id).maybeSingle()
        : Promise.resolve({ data: null }),
      asset.initiative_id
        ? supabase.from('initiatives').select('id, title').eq('id', asset.initiative_id).maybeSingle()
        : Promise.resolve({ data: null }),
      asset.contributed_by
        ? supabase.from('profiles').select('id, name, email').eq('id', asset.contributed_by).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('content_calendar')
        .select('id, title, status, scheduled_at, attached_media_refs')
        .contains('attached_media_refs', [asset.id])
        .order('scheduled_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('media_recovery_requests')
        .select('id, title, status')
        .eq('resolved_asset_id', asset.id)
        .maybeSingle(),
    ])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/app/comms/media" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800">
        ← Back to media library
      </Link>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${MEDIA_ASSET_TYPE_META[asset.asset_type as MediaAssetType]?.tone ?? 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
                {MEDIA_ASSET_TYPE_META[asset.asset_type as MediaAssetType]?.label ?? asset.asset_type}
              </span>
              <RightsStatusBadge status={asset.rights_status} />
            </div>

            <div>
              <h1 className="text-3xl font-semibold text-neutral-900">{asset.title}</h1>
              <p className="text-sm text-neutral-500">Created {formatDateLabel(asset.created_at)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <p className="font-semibold text-neutral-900">Usage count</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{asset.usage_count}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-900">Source context</p>
            <div className="space-y-2 text-sm text-neutral-600">
              <p>Event: {event?.name ?? 'Not linked'}</p>
              <p>
                Session:{' '}
                {session
                  ? session.theme ||
                    new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
                      new Date(session.session_date)
                    )
                  : 'Not linked'}
              </p>
              <p>Initiative: {initiative?.title ?? 'Not linked'}</p>
              <p>Contributor: {contributor?.name ?? contributor?.email ?? 'Unknown'}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-900">SharePoint reference</p>
            {asset.sharepoint_url ? (
              <a href={asset.sharepoint_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
                {asset.sharepoint_url}
              </a>
            ) : (
              <p className="text-sm text-neutral-500">No SharePoint URL has been attached yet.</p>
            )}
            {linkedRecovery && (
              <p className="text-sm text-neutral-600">
                Resolved from recovery request: <span className="font-semibold text-neutral-900">{linkedRecovery.title}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {(asset.tags ?? []).map((tag) => (
            <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
              #{tag}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Usage log</h2>
        <div className="mt-4 space-y-3">
          {(linkedEntries ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">This asset has not been referenced in the content calendar yet.</p>
          ) : (
            linkedEntries?.map((entry) => (
              <Link key={entry.id} href="/app/comms/calendar" className="block rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
                <p className="text-sm font-semibold text-neutral-900">{entry.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {entry.status} · {entry.scheduled_at ? formatDateLabel(entry.scheduled_at) : 'Unscheduled'}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
