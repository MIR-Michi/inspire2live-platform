/**
 * podcast-planning/ui/radar-screen.tsx — the fifth screen.
 *
 * Phase A deliberately did not name Radar in the navigation, on the grounds
 * that an empty tab teaches nothing. It exists now because there is something
 * in it — and the empty state is written to keep that true: when there is
 * nothing to review it says what was looked at and when, rather than showing a
 * blank page that is indistinguishable from a broken feature.
 *
 * Split in two on purpose. `RadarScreen` reads; `RadarReview` renders and knows
 * nothing about where the rows came from — which is what lets the onboarding
 * tour put the *real* review on stage with a worked example instead of a
 * redrawing of it that would quietly go stale.
 */

import { loadQuestions } from '@/modules/podcast-planning/domain/repository'
import {
  loadProposals,
  loadSignalsByIds,
  loadRadarStatus,
} from '@/modules/podcast-planning/domain/radar-repository'
import type { RadarProposal, RadarRunStatus } from '@/modules/podcast-planning/domain/radar-types'
import { ProposalCard, type ProposalEvidence } from '@/modules/podcast-planning/ui/proposal-card'

/** One proposal with everything needed to show it — no loading, no lookups. */
export type RadarReviewItem = {
  proposal: RadarProposal
  evidence: ProposalEvidence[]
  /** Set when the proposal is for a question that already exists. */
  questionLabel: string | null
}

function relative(iso: string | null): string {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (Number.isNaN(days)) return 'never'
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.floor(days / 7)} weeks ago`
}

export async function RadarScreen() {
  const [proposals, status, questions] = await Promise.all([
    loadProposals({ status: 'pending' }),
    loadRadarStatus(),
    loadQuestions({ status: 'all' }),
  ])

  const signals = await loadSignalsByIds(proposals.flatMap((p) => p.signalIds))
  const questionText = new Map(questions.map((q) => [q.id, q.question]))

  const evidenceFor = (ids: string[]): ProposalEvidence[] =>
    ids
      .map((id) => signals.get(id))
      .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map((signal) => ({
        id: signal.id,
        title: signal.title,
        url: signal.url,
        publishedAt: signal.publishedAt,
        source: signal.source,
      }))

  return (
    <RadarReview
      status={status}
      items={proposals.map((proposal) => ({
        proposal,
        evidence: evidenceFor(proposal.signalIds),
        questionLabel: proposal.questionId
          ? (questionText.get(proposal.questionId) ?? null)
          : null,
      }))}
    />
  )
}

export function RadarReview({
  items,
  status,
}: {
  items: RadarReviewItem[]
  status: RadarRunStatus
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">
          {items.length > 0 ? `${items.length} to look at` : 'Nothing waiting'}
        </h2>
        <p className="text-xs text-neutral-500">
          {status.status === 'running'
            ? (status.message ?? 'Scanning…')
            : `Last scan ${relative(status.finishedAt)}`}
        </p>
      </header>

      {status.status === 'error' && status.message && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{status.message}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-neutral-800">Nothing to review.</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-neutral-500">
            {/* What was looked at, always. Silence and a broken scan look the
                same, and only one of them is fine. */}
            {status.status === 'success' && status.message
              ? status.message
              : 'The scan has not run yet. It reads the open scholarly sources every fortnight and only puts a question here when several independent sources point the same way.'}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs text-neutral-400">
            You do not have to wait for it — open a question and ask for names directly.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ProposalCard
              key={item.proposal.id}
              proposal={item.proposal}
              evidence={item.evidence}
              questionLabel={item.questionLabel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
