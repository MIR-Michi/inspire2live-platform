'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { createMediaAsset, resolveRecoveryRequest, type MediaFormState } from '@/app/app/comms/media/actions'
import { triggerSharePointBrowseStub } from '@/app/app/comms/integration-actions'
import { IntegrationStubForm } from '@/components/comms/integration-stub-form'
import { RightsStatusBadge } from '@/components/comms/rights-status-badge'
import { ActionModal } from '@/components/ui/action-modal'
import { MEDIA_ASSET_TYPE_META, type MediaAssetType } from '@/lib/comms-media'
import type { IntegrationStubFlags } from '@/lib/comms-integrations'

type Option = { id: string; label: string }

type MediaAssetCard = {
  id: string
  title: string
  asset_type: string
  sharepoint_url: string | null
  rights_status: string
  tags: string[] | null
  usage_count: number
  created_at: string
  eventLabel: string | null
  sessionLabel: string | null
  contributorLabel: string | null
}

type RecoveryOffer = {
  id: string
  offered_by: string
  notes: string
  sharepoint_url: string | null
  created_at: string
}

type RecoveryRequestCard = {
  id: string
  title: string
  summary: string
  status: string
  created_at: string
  initiativeLabel: string | null
  eventLabel: string | null
  sessionLabel: string | null
  offers: RecoveryOffer[]
}

const INITIAL_STATE: MediaFormState = { ok: false }

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  )
}

function CreateMediaAssetModal({
  open,
  onClose,
  events,
  sessions,
  initiatives,
}: {
  open: boolean
  onClose: () => void
  events: Option[]
  sessions: Option[]
  initiatives: Option[]
}) {
  const [state, formAction, pending] = useActionState(createMediaAsset, INITIAL_STATE)

  useEffect(() => {
    if (state.ok) onClose()
  }, [state.ok, onClose])

  return (
    <ActionModal title="Create media asset" open={open} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Title</span>
          <input name="title" required className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Type</span>
            <select name="asset_type" defaultValue="photo" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              {Object.entries(MEDIA_ASSET_TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Rights status</span>
            <select name="rights_status" defaultValue="internal_only" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              <option value="internal_only">Internal only</option>
              <option value="approved_for_publication">Approved for publication</option>
              <option value="needs_clearance">Needs clearance</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">SharePoint URL</span>
          <input
            type="url"
            name="sharepoint_url"
            placeholder="Paste the SharePoint or OneDrive URL"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Event</span>
            <select name="event_id" defaultValue="" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              <option value="">No linked event</option>
              {events.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Session</span>
            <select name="session_id" defaultValue="" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              <option value="">No linked session</option>
              {sessions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Initiative</span>
            <select name="initiative_id" defaultValue="" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              <option value="">No linked initiative</option>
              {initiatives.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Tags</span>
          <input
            name="tags"
            placeholder="congress, guide-mrd, interview"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        {state.error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-orange-300">
            {pending ? 'Saving…' : 'Create asset'}
          </button>
        </div>
      </form>
    </ActionModal>
  )
}

function ResolveRecoveryModal({
  open,
  onClose,
  request,
}: {
  open: boolean
  onClose: () => void
  request: RecoveryRequestCard
}) {
  const [state, formAction, pending] = useActionState(resolveRecoveryRequest, INITIAL_STATE)

  useEffect(() => {
    if (state.ok) onClose()
  }, [state.ok, onClose])

  return (
    <ActionModal title="Resolve recovery request" open={open} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="recovery_request_id" value={request.id} />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{request.title}</p>
          <p className="mt-1">{request.summary}</p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Asset title</span>
          <input
            name="title"
            defaultValue={request.title}
            required
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Asset type</span>
            <select name="asset_type" defaultValue="photo" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              {Object.entries(MEDIA_ASSET_TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Rights status</span>
            <select name="rights_status" defaultValue="needs_clearance" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
              <option value="internal_only">Internal only</option>
              <option value="approved_for_publication">Approved for publication</option>
              <option value="needs_clearance">Needs clearance</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">SharePoint URL</span>
          <input
            type="url"
            name="sharepoint_url"
            required
            placeholder="Paste the resolved SharePoint asset URL"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Tags</span>
          <input
            name="tags"
            placeholder="congress, photos, follow-up"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Resolution notes</span>
          <textarea
            name="resolution_notes"
            rows={4}
            defaultValue={request.offers.map((offer) => `${offer.offered_by}: ${offer.notes}`).join('\n\n')}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        {state.error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-orange-300">
            {pending ? 'Resolving…' : 'Resolve and create asset'}
          </button>
        </div>
      </form>
    </ActionModal>
  )
}

export function MediaLibraryShell({
  assets,
  recoveryRequests,
  events,
  sessions,
  initiatives,
  stubFlags,
}: {
  assets: MediaAssetCard[]
  recoveryRequests: RecoveryRequestCard[]
  events: Option[]
  sessions: Option[]
  initiatives: Option[]
  stubFlags: IntegrationStubFlags
}) {
  const [search, setSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | MediaAssetType>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [resolvingRequest, setResolvingRequest] = useState<RecoveryRequestCard | null>(null)

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(assets.flatMap((asset) => asset.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
      ).sort(),
    [assets]
  )

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return assets.filter((asset) => {
      const matchesSearch =
        !query ||
        asset.title.toLowerCase().includes(query) ||
        (asset.contributorLabel ?? '').toLowerCase().includes(query) ||
        (asset.eventLabel ?? '').toLowerCase().includes(query) ||
        (asset.sessionLabel ?? '').toLowerCase().includes(query) ||
        (asset.tags ?? []).some((tag) => tag.toLowerCase().includes(query))

      const matchesType = assetTypeFilter === 'all' || asset.asset_type === assetTypeFilter
      const sourceKey = asset.eventLabel
        ? `event:${asset.eventLabel}`
        : asset.sessionLabel
          ? `session:${asset.sessionLabel}`
          : 'none'
      const matchesSource = sourceFilter === 'all' || sourceKey === sourceFilter
      const matchesTag = tagFilter === 'all' || (asset.tags ?? []).includes(tagFilter)

      return matchesSearch && matchesType && matchesSource && matchesTag
    })
  }, [assetTypeFilter, assets, search, sourceFilter, tagFilter])

  const sourceOptions = useMemo(() => {
    const options = new Map<string, string>()
    assets.forEach((asset) => {
      if (asset.eventLabel) options.set(`event:${asset.eventLabel}`, `Event · ${asset.eventLabel}`)
      if (asset.sessionLabel) options.set(`session:${asset.sessionLabel}`, `Session · ${asset.sessionLabel}`)
    })
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }))
  }, [assets])

  return (
    <section className="flex flex-col gap-6 xl:h-[calc(100vh-7rem)] xl:min-h-0 xl:overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 xl:shrink-0">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">SharePoint-linked media</p>
          <h2 className="text-2xl font-semibold text-neutral-900">Media library</h2>
          <p className="max-w-3xl text-sm text-neutral-600">
            Searchable asset records linked to SharePoint, plus a recovery queue for open media requests coming from intake.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {stubFlags.sharepoint && (
            <IntegrationStubForm
              action={triggerSharePointBrowseStub}
              entityId="00000000-0000-0000-0000-000000000000"
              buttonLabel="+ from SharePoint"
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
              hiddenFields={[{ name: 'entity_type', value: 'media_assets' }]}
            />
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            Create asset
          </button>
        </div>
      </header>

      <CreateMediaAssetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        events={events}
        sessions={sessions}
        initiatives={initiatives}
      />

      <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-4 xl:shrink-0">
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-neutral-800">Search assets</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, contributor, event, session, or tag"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Asset type</span>
          <select
            value={assetTypeFilter}
            onChange={(event) => setAssetTypeFilter(event.target.value as 'all' | MediaAssetType)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            {Object.entries(MEDIA_ASSET_TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-800">Tag filter</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-neutral-800">Event / session</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="all">All sources</option>
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="space-y-4 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {filteredAssets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
              <p className="text-base font-semibold text-neutral-900">No media assets match these filters.</p>
              <p className="mt-2 text-sm text-neutral-500">
                Adjust the filters or add a new SharePoint-linked asset to the library.
              </p>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${MEDIA_ASSET_TYPE_META[asset.asset_type as MediaAssetType]?.tone ?? 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
                        {MEDIA_ASSET_TYPE_META[asset.asset_type as MediaAssetType]?.label ?? asset.asset_type}
                      </span>
                      <RightsStatusBadge status={asset.rights_status} />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{asset.title}</h3>
                      <p className="text-sm text-neutral-500">
                        {asset.eventLabel || asset.sessionLabel || 'No linked event or session'} ·{' '}
                        {asset.contributorLabel ?? 'Unknown contributor'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
                        Usage count: {asset.usage_count}
                      </span>
                      {(asset.tags ?? []).map((tag) => (
                        <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Link href={`/app/comms/media/${asset.id}`} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                    Open detail
                  </Link>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span>{formatDateLabel(asset.created_at)}</span>
                  {asset.sharepoint_url && (
                    <a href={asset.sharepoint_url} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                      SharePoint URL
                    </a>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <section className="space-y-4 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pl-1">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900">Media recovery queue</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Type-5 intake items become tracked recovery requests. Later offers stay attached until the coordinator resolves them with a SharePoint URL.
            </p>
          </div>

          {recoveryRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
              <p className="text-base font-semibold text-neutral-900">No open recovery requests.</p>
              <p className="mt-2 text-sm text-neutral-500">
                Route a media request from intake to start the recovery queue.
              </p>
            </div>
          ) : (
            recoveryRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${request.status === 'resolved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {request.status === 'resolved' ? 'Resolved' : 'Open'}
                      </span>
                      {request.eventLabel && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {request.eventLabel}
                        </span>
                      )}
                      {request.sessionLabel && (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                          {request.sessionLabel}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-neutral-900">{request.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">{request.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {request.initiativeLabel && (
                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
                          {request.initiativeLabel}
                        </span>
                      )}
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-600">
                        {request.offers.length} offer{request.offers.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {request.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => setResolvingRequest(request)}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
                    >
                      Resolve
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {request.offers.length === 0 ? (
                    <p className="text-sm text-neutral-500">No linked offers yet.</p>
                  ) : (
                    request.offers.map((offer) => (
                      <div key={offer.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                        <p className="text-sm font-semibold text-neutral-900">{offer.offered_by}</p>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">{offer.notes}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                          <span>{formatDateLabel(offer.created_at)}</span>
                          {offer.sharepoint_url && (
                            <a href={offer.sharepoint_url} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                              Offered link
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {resolvingRequest && (
        <ResolveRecoveryModal
          open={true}
          onClose={() => setResolvingRequest(null)}
          request={resolvingRequest}
        />
      )}
    </section>
  )
}
