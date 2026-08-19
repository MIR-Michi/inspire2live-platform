'use client'

/**
 * publishing/ui/publishing-shell.tsx — the Publishing space: source → draft →
 * approve on one screen (concept §9).
 *
 * UX rules this file holds to: one decision visible at a time, one- or
 * two-word labels, affordances instead of instructions, and every degraded
 * state designed rather than apologised for (nothing selected, not enough
 * material, generating, provider error + retry, stale source, over budget
 * after editing, rights not cleared, already approved, superseded run).
 *
 * All mutations arrive as server-action props wired by the thin route — the
 * shell renders and orchestrates; every gate is enforced again in the domain.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ActionModal, CharacterRing, ImageDropZone, StatusBadge } from '@/kernel/ui'
import type { ImageDropZoneValue } from '@/kernel/ui'
import type { SourceCandidate, SourceRightsStatus } from '@/kernel/publishing'
import {
  RIGHTS_META,
  RIGHTS_STATUSES,
  type PublishingDraft,
} from '@/modules/publishing/domain/types'

export type PublishingActionState = {
  ok: boolean
  error?: string
  message?: string
  sourceId?: string
  postId?: string
  warning?: string
}

export type PublishingShellChannel = {
  channel: string
  label: string
  enabled: boolean
  budget: number
}

export type PublishingShellSource = {
  sourceType: string
  sourceId: string
  title: string
  occurredAt: string | null
  reviewHref: string
  providerLabel: string
  fieldLabels: string[]
  rights: SourceRightsStatus | null
  imageUrl: string | null
  ready: boolean
  readinessReason: string | null
  stale: boolean
  staleBehaviour: 'warn' | 'block'
}

export type PublishingShellActions = {
  createAdhocSource: (formData: FormData) => Promise<PublishingActionState>
  generateDrafts: (input: { sourceType: string; sourceId: string; channel: string }) => Promise<PublishingActionState>
  editDraft: (input: { draftId: string; body: string }) => Promise<PublishingActionState>
  approveDraft: (input: { draftId: string; sourceType: string; sourceId: string }) => Promise<PublishingActionState>
  dismissDraft: (input: { draftId: string }) => Promise<PublishingActionState>
  savePost: (input: { draftId: string }) => Promise<PublishingActionState>
}

export type PublishingShellProps = {
  channels: PublishingShellChannel[]
  activeChannel: string
  candidates: Array<SourceCandidate & { providerLabel: string }>
  source: PublishingShellSource | null
  drafts: PublishingDraft[]
  /** Draft id → the saved post it became, for the variants already kept. */
  postIdByDraftId: Record<string, string>
  maxUploadMegabytes: number
  actions: PublishingShellActions
}

function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function spaceHref(sourceType: string, sourceId: string): string {
  return `/app/comms/publishing?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`
}

function postHref(postId: string): string {
  return `/app/comms/publishing/posts/${postId}`
}

export function PublishingShell({
  channels,
  activeChannel,
  candidates,
  source,
  drafts,
  postIdByDraftId,
  maxUploadMegabytes,
  actions,
}: PublishingShellProps) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const budget = channels.find((entry) => entry.channel === activeChannel)?.budget ?? 0
  const pending = drafts.filter((draft) => draft.status === 'pending')
  const approved = drafts.find((draft) => draft.status === 'approved') ?? null
  const handedOver = drafts.find((draft) => draft.status === 'published') ?? null
  const step: 1 | 2 | 3 = approved || handedOver ? 3 : pending.length > 0 ? 2 : 1

  const run = (action: () => Promise<PublishingActionState>, after?: (state: PublishingActionState) => void) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const state = await action()
      if (!state.ok) {
        setError(state.error ?? 'Something went wrong.')
        return
      }
      if (state.warning) setNotice(state.warning)
      else if (state.message) setNotice(state.message)
      after?.(state)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <StepHeader step={step} />

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>
      )}

      {/* ① SOURCE */}
      {!source && (
        <SourceStep
          candidates={candidates}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          maxUploadMegabytes={maxUploadMegabytes}
          busy={busy}
          onAdhoc={(formData) =>
            run(
              () => actions.createAdhocSource(formData),
              (state) => {
                if (state.sourceId) router.push(spaceHref('adhoc', state.sourceId))
              },
            )
          }
        />
      )}

      {source && (
        <SelectedSourceCard
          source={source}
          busy={busy}
          hasDrafts={drafts.length > 0}
          onGenerate={() =>
            run(() => actions.generateDrafts({ sourceType: source.sourceType, sourceId: source.sourceId, channel: activeChannel }))
          }
        />
      )}

      <ChannelRow channels={channels} activeChannel={activeChannel} />

      {/* Stale source (linked source edited after generation) */}
      {source?.stale && drafts.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${source.staleBehaviour === 'block' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {source.staleBehaviour === 'block'
            ? 'The source changed since these drafts were generated — regenerate before approving.'
            : 'The source changed since these drafts were generated.'}
        </div>
      )}

      {/* ② DRAFT */}
      {busy && pending.length === 0 && source && !approved && !handedOver && <GeneratingState />}

      {pending.length > 0 && source && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Drafts</h2>
            <button
              type="button"
              disabled={busy || (source.staleBehaviour === 'block' && source.stale && !source.ready)}
              onClick={() =>
                run(() => actions.generateDrafts({ sourceType: source.sourceType, sourceId: source.sourceId, channel: activeChannel }))
              }
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {pending.map((draft) => (
              <VariantCard
                key={draft.id}
                draft={draft}
                budget={budget}
                imageUrl={source.imageUrl}
                busy={busy}
                approveBlocked={source.stale && source.staleBehaviour === 'block'}
                savedPostId={postIdByDraftId[draft.id] ?? null}
                onEdit={(body) => run(() => actions.editDraft({ draftId: draft.id, body }))}
                onApprove={() =>
                  run(() => actions.approveDraft({ draftId: draft.id, sourceType: source.sourceType, sourceId: source.sourceId }))
                }
                onSave={() =>
                  run(
                    () => actions.savePost({ draftId: draft.id }),
                    (state) => {
                      if (state.postId) router.push(postHref(state.postId))
                    },
                  )
                }
                onDismiss={() => run(() => actions.dismissDraft({ draftId: draft.id }))}
              />
            ))}
          </div>
        </section>
      )}

      {/* ③ APPROVE — the copy is now a saved post; everything else happens there */}
      {(approved || handedOver) && (
        <ApprovedPanel
          draft={handedOver ?? approved!}
          postId={postIdByDraftId[(handedOver ?? approved!).id] ?? null}
          onCopy={(text) => {
            void navigator.clipboard.writeText(text)
            setNotice('Copied.')
          }}
        />
      )}
    </div>
  )
}

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  const steps: Array<{ n: 1 | 2 | 3; label: string }> = [
    { n: 1, label: 'Source' },
    { n: 2, label: 'Draft' },
    { n: 3, label: 'Approve' },
  ]
  return (
    <ol className="flex items-center gap-2" aria-label="Publishing steps">
      {steps.map(({ n, label }) => (
        <li key={n} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              n === step ? 'bg-orange-600 text-white' : n < step ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-400'
            }`}
            aria-current={n === step ? 'step' : undefined}
          >
            {n}
          </span>
          <span className={`text-sm font-semibold ${n === step ? 'text-neutral-900' : 'text-neutral-400'}`}>{label}</span>
          {n < 3 && <span className="mx-1 h-px w-8 bg-neutral-200" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

function SourceStep({
  candidates,
  pickerOpen,
  setPickerOpen,
  maxUploadMegabytes,
  busy,
  onAdhoc,
}: {
  candidates: Array<SourceCandidate & { providerLabel: string }>
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  maxUploadMegabytes: number
  busy: boolean
  onAdhoc: (formData: FormData) => void
}) {
  const [upload, setUpload] = useState<{ file: File; previewUrl: string } | null>(null)
  const [description, setDescription] = useState('')
  const [rights, setRights] = useState<SourceRightsStatus | null>(null)

  // The object URL lives exactly as long as the selection — created and
  // revoked in the event handlers, so no effect and no ref-in-render.
  const selectFile = (file: File) => {
    if (upload) URL.revokeObjectURL(upload.previewUrl)
    setUpload({ file, previewUrl: URL.createObjectURL(file) })
  }
  const clearFile = () => {
    if (upload) URL.revokeObjectURL(upload.previewUrl)
    setUpload(null)
  }

  const dropValue: ImageDropZoneValue | null = upload
    ? { name: upload.file.name, previewUrl: upload.previewUrl }
    : null

  const submit = () => {
    if (!upload || !description.trim() || !rights) return
    const formData = new FormData()
    formData.set('image', upload.file)
    formData.set('description', description.trim())
    formData.set('rights', rights)
    onAdhoc(formData)
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {/* Tile 1: from the platform */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zm4.5 4.5h7.5m-7.5 3.75h4.5" />
        </svg>
        <p className="text-sm font-semibold text-neutral-800">From the platform</p>
        <p className="text-xs text-neutral-400">recent records ▸</p>
      </button>

      {/* Tile 2: drop a screenshot — after a drop: image, a line, a chip. */}
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <ImageDropZone
          value={dropValue}
          onSelect={selectFile}
          onClear={clearFile}
          disabled={busy}
          hint={`or click to choose · paste works too · up to ${maxUploadMegabytes} MB`}
        />
        {upload && (
          <>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this?"
              maxLength={280}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              aria-label="What is this?"
            />
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Rights">
              {RIGHTS_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={rights === status}
                  onClick={() => setRights(status)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    rights === status
                      ? status === 'approved_for_publication'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : status === 'internal_only'
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-red-300 bg-red-50 text-red-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  {RIGHTS_META[status].label}
                </button>
              ))}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !description.trim() || !rights}
                className="ml-auto rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Use it
              </button>
            </div>
          </>
        )}
      </div>

      <ActionModal title="Pick a source" open={pickerOpen} onClose={() => setPickerOpen(false)}>
        {candidates.length === 0 ? (
          <p className="text-sm text-neutral-500">No recent records to publish from yet.</p>
        ) : (
          <ul className="max-h-96 space-y-1.5 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={`${candidate.sourceType}:${candidate.sourceId}`}>
                <Link
                  href={spaceHref(candidate.sourceType, candidate.sourceId)}
                  onClick={() => setPickerOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm hover:border-orange-300 hover:bg-orange-50/40"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-neutral-800">{candidate.label}</span>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                    {candidate.providerLabel}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{formatDate(candidate.occurredAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ActionModal>
    </section>
  )
}

function SelectedSourceCard({
  source,
  busy,
  hasDrafts,
  onGenerate,
}: {
  source: PublishingShellSource
  busy: boolean
  hasDrafts: boolean
  onGenerate: () => void
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {source.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
          <img src={source.imageUrl} alt={source.title} className="h-14 w-14 shrink-0 rounded-xl border border-neutral-200 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-neutral-900">{source.title}</h1>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">{source.providerLabel}</span>
            {source.rights && (
              <StatusBadge label={RIGHTS_META[source.rights].label} tone={RIGHTS_META[source.rights].tone} />
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            {formatDate(source.occurredAt)}
            {source.fieldLabels.length > 0 && <> · {source.fieldLabels.join(' · ')}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={source.reviewHref} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
            Review
          </Link>
          <Link href="/app/comms/publishing" className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
            Change
          </Link>
        </div>
      </div>

      {!source.ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Not enough to work with yet.</p>
          {source.readinessReason && <p className="mt-0.5">{source.readinessReason.replace(/^Not enough to work with yet\.\s*/, '')}</p>}
          <Link href={source.reviewHref} className="mt-1 inline-block text-xs font-semibold text-amber-900 underline">
            Add material
          </Link>
        </div>
      )}

      {source.ready && !hasDrafts && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {busy ? 'Drafting…' : 'Draft'}
        </button>
      )}
    </section>
  )
}

function ChannelRow({ channels, activeChannel }: { channels: PublishingShellChannel[]; activeChannel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Channels">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">in</span>
      {channels.map((entry) =>
        entry.enabled ? (
          <span
            key={entry.channel}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              entry.channel === activeChannel ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-neutral-200 text-neutral-500'
            }`}
          >
            {entry.label}
          </span>
        ) : (
          <span
            key={entry.channel}
            title="Not yet available"
            aria-disabled="true"
            className="cursor-not-allowed rounded-full border border-dashed border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-300"
          >
            {entry.label}
          </span>
        ),
      )}
    </div>
  )
}

function GeneratingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-label="Generating drafts" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
          <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-3 w-32 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  )
}

function VariantCard({
  draft,
  budget,
  imageUrl,
  busy,
  approveBlocked,
  savedPostId,
  onEdit,
  onApprove,
  onSave,
  onDismiss,
}: {
  draft: PublishingDraft
  budget: number
  imageUrl: string | null
  busy: boolean
  approveBlocked: boolean
  savedPostId: string | null
  onEdit: (body: string) => void
  onApprove: () => void
  onSave: () => void
  onDismiss: () => void
}) {
  const [text, setText] = useState(draft.body)
  const [claimsOpen, setClaimsOpen] = useState(false)
  const diverged = text !== draft.aiBody
  const overBudget = budget > 0 && text.length > budget

  const fieldLabel = (key: string) => draft.sourceFields.find((field) => field.key === key)?.label ?? key

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-wide text-orange-700">{draft.angle || 'Draft'}</span>
        <span className="flex items-center gap-2">
          {diverged && (
            <span title="Edited — differs from the model draft" className="h-2 w-2 rounded-full bg-violet-400" aria-label="Edited" />
          )}
          <CharacterRing count={text.length} budget={budget} />
        </span>
      </header>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text.trim() && text !== draft.body) onEdit(text)
        }}
        rows={9}
        disabled={busy}
        className={`w-full resize-y rounded-xl border px-3 py-2 text-sm leading-relaxed focus:outline-none ${
          overBudget ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-orange-400'
        }`}
        aria-label={`Draft: ${draft.angle ?? 'variant'}`}
      />
      {overBudget && <p className="text-xs font-semibold text-red-600">Over budget — trim before it goes out.</p>}

      {draft.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.hashtags.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      )}

      {imageUrl && draft.imageDescription && (
        <div className="flex items-start gap-2 rounded-xl bg-neutral-50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
          <img src={imageUrl} alt="Source" className="h-10 w-10 shrink-0 rounded-lg border border-neutral-200 object-cover" />
          <p className="text-xs text-neutral-500">
            <span className="font-semibold text-neutral-600">Model saw:</span> {draft.imageDescription}
          </p>
        </div>
      )}

      {draft.claims.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setClaimsOpen(!claimsOpen)}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
            aria-expanded={claimsOpen}
          >
            {claimsOpen ? '▾' : '▸'} Claims ({draft.claims.length})
          </button>
          {claimsOpen && (
            <ul className="mt-1.5 space-y-1">
              {draft.claims.map((claim, index) => (
                <li key={index} className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                  {claim.text}
                  <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200">
                    {fieldLabel(claim.sourceFieldKey)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy || approveBlocked}
          title={approveBlocked ? 'The source changed — regenerate first' : undefined}
          className="rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Approve
        </button>
        {savedPostId ? (
          <Link
            href={postHref(savedPostId)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Open post
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            title="Keep this as a post you can finish later"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Save
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="ml-auto rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
        >
          Dismiss
        </button>
      </footer>
    </article>
  )
}

/**
 * The end of the wizard. Approving does not finish the job any more — it hands
 * the copy to a saved post that carries the picture, the owner and the status
 * from here on, so this panel points at the post rather than trying to be it.
 */
function ApprovedPanel({
  draft,
  postId,
  onCopy,
}: {
  draft: PublishingDraft
  postId: string | null
  onCopy: (text: string) => void
}) {
  const copyText = [draft.body, draft.hashtags.join(' ')].filter(Boolean).join('\n\n')

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
      <header className="flex items-center gap-2">
        <StatusBadge label="Approved" tone="green" />
        {draft.approvedAt && <span className="text-xs text-neutral-400">{formatDate(draft.approvedAt)}</span>}
      </header>
      <p className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-800">{copyText}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onCopy(copyText)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
          Copy
        </button>
        {postId && (
          <Link
            href={postHref(postId)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
          >
            Open post
          </Link>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Add a picture, change the owner and mark it published on the post itself.
      </p>
    </section>
  )
}
