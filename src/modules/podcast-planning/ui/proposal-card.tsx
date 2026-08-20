'use client'

/**
 * podcast-planning/ui/proposal-card.tsx — the whole review interaction.
 *
 * One card. A question, the evidence under it, the names attached, and two
 * buttons. The design constraint is that a fortnight's proposals should be
 * cleared in the time it takes to drink a coffee, which rules out an editor, a
 * detail page and a confirmation dialog — the three things that turn a
 * five-second judgement into a task somebody postpones.
 *
 * Names are ticked by default. That is a deliberate call: the primary button
 * has to do something, and a card that opens with nothing selected makes the
 * common case ("yes, all of them") the one that takes the most taps. Untick to
 * exclude.
 *
 * Dismissing costs one tap and always asks which of three reasons — not to make
 * it harder, but because "already covered" and "not our agenda" are the only
 * training signal this feature will ever get, and an undifferentiated no tells
 * us nothing.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptProposal, dismissProposal } from '@/modules/podcast-planning/domain/radar-actions'
import type { RadarProposal, DismissReason } from '@/modules/podcast-planning/domain/radar-types'
import { DISMISS_REASON_META } from '@/modules/podcast-planning/domain/radar-types'
import { IconCheck, IconClose, IconQuestion, InitialsAvatar } from '@/modules/podcast-planning/ui/icons'

export type ProposalEvidence = {
  id: string
  title: string
  url: string | null
  publishedAt: string | null
  source: string
}

const SOURCE_LABEL: Record<string, string> = {
  openalex: 'Open scholarly record',
  europepmc: 'Europe PMC',
  congress_programme: 'Congress programme',
  regulator: 'Regulator',
  web: 'Web',
}

function formatDate(value: string | null): string {
  if (!value) return 'undated'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'undated'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ProposalCard({
  proposal,
  evidence,
  questionLabel,
}: {
  proposal: RadarProposal
  evidence: ProposalEvidence[]
  /** Set when the proposal is for a question that already exists. */
  questionLabel?: string | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(proposal.names.map((_, index) => index)),
  )
  const [showEvidence, setShowEvidence] = useState(false)
  const [askingWhy, setAskingWhy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const accept = () =>
    startTransition(async () => {
      setError(null)
      const result = await acceptProposal(proposal.id, { selected: [...selected].sort((a, b) => a - b) })
      if (!result.ok) setError(result.error)
      else router.refresh()
    })

  const dismiss = (reason: DismissReason) =>
    startTransition(async () => {
      setError(null)
      const result = await dismissProposal(proposal.id, reason)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })

  const sourceCount = evidence.length
  const acceptLabel = proposal.questionId
    ? `Add ${selected.size} to the wishlist`
    : selected.size > 0
      ? `Open the question with ${selected.size} name${selected.size === 1 ? '' : 's'}`
      : 'Open the question'

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {/* ── The question ── */}
      <header className="space-y-2 border-b border-neutral-100 px-5 py-4">
        {questionLabel && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
            <IconQuestion className="h-3.5 w-3.5" />
            {questionLabel}
          </p>
        )}
        <h3 className="text-base font-semibold leading-snug text-neutral-900">
          {proposal.proposedQuestion}
        </h3>
        {/* `data-copy`: this is the evidence the proposal rests on, not a
            subtitle — see the copy-cleanup rule in globals.css. */}
        {proposal.whyNow && (
          <p data-copy className="text-sm leading-relaxed text-neutral-600">
            {proposal.whyNow}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          aria-expanded={showEvidence}
          className="text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          {sourceCount} source{sourceCount === 1 ? '' : 's'}
          {proposal.whyNowAt ? ` · most recent ${formatDate(proposal.whyNowAt)}` : ''}
          {showEvidence ? ' — hide' : ''}
        </button>

        {showEvidence && (
          <ul className="space-y-1.5 rounded-lg bg-neutral-50 p-3">
            {evidence.map((item) => (
              <li key={item.id} className="text-xs leading-relaxed text-neutral-600">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-neutral-900 underline underline-offset-2"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="font-medium text-neutral-900">{item.title}</span>
                )}
                <span className="text-neutral-500">
                  {' '}
                  · {SOURCE_LABEL[item.source] ?? item.source} · {formatDate(item.publishedAt)}
                </span>
              </li>
            ))}
            {evidence.length === 0 && (
              <li className="text-xs text-neutral-500">
                The records behind this are no longer stored.
              </li>
            )}
          </ul>
        )}
      </header>

      {/* ── The names ── */}
      {proposal.names.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {proposal.names.map((name, index) => {
            const on = selected.has(index)
            return (
              <li key={`${name.signalId}-${name.name}`}>
                <label
                  className={`flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors ${
                    on ? 'bg-white' : 'bg-neutral-50/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(index)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                  />
                  <InitialsAvatar name={name.name} className="mt-0.5 h-8 w-8 text-xs" />
                  <div className={`min-w-0 flex-1 ${on ? '' : 'opacity-55'}`}>
                    <p className="text-sm font-semibold text-neutral-900">
                      {name.name}
                      {name.sourceCount > 1 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          {name.sourceCount} sources
                        </span>
                      )}
                    </p>
                    {(name.role || name.organisation) && (
                      <p className="truncate text-xs text-neutral-500">
                        {[name.role, name.organisation, name.country].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="mt-1 text-sm leading-relaxed text-neutral-700">{name.angle}</p>
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {proposal.names.length === 0 && (
        <p className="px-5 py-4 text-sm text-neutral-500">
          No names attached — this is a question looking for somebody to answer it.
        </p>
      )}

      {/* ── The two gestures ── */}
      <footer className="space-y-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        )}

        {askingWhy ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-neutral-600">Why not?</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DISMISS_REASON_META) as DismissReason[]).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={pending}
                  onClick={() => dismiss(reason)}
                  title={DISMISS_REASON_META[reason].hint}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  {DISMISS_REASON_META[reason].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAskingWhy(false)}
                className="px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-900"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={accept}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <IconCheck className="h-4 w-4" />
              {pending ? 'Opening…' : acceptLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAskingWhy(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
            >
              <IconClose className="h-4 w-4" />
              Not this
            </button>
          </div>
        )}
      </footer>
    </article>
  )
}
