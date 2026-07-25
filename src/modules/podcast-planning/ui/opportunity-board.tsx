/**
 * podcast-planning/ui/opportunity-board.tsx — the six-stage board.
 *
 * Concept §3 and §4. Two things this layout has to get right:
 *
 *  - **Waiting is not to-do.** Ask and Planning are tinted differently and are
 *    the only columns that show a day counter, because a card you are waiting on
 *    is a different problem from a card you owe work on.
 *  - **The ceiling is visible before it bites.** The Ask column shows how many of
 *    the allowed open asks are used, so the limit reads as a working practice
 *    rather than as an error message that appears when you try to move a card.
 */

import Link from 'next/link'
import { StatusBadge } from '@/kernel/ui'
import { BOARD_STAGES, STAGE_META } from '@/modules/podcast-planning/domain/stages'
import { BAND_META, bandFor, rankCandidates } from '@/modules/podcast-planning/domain/scoring'
import type { CandidateStage, PlanningConfig } from '@/modules/podcast-planning/domain/types'
import type { BoardCard, BoardView } from '@/modules/podcast-planning/domain/repository'

const STAGE_TONE: Record<CandidateStage, string> = {
  wishlist: 'bg-neutral-50 border-neutral-200',
  research: 'bg-neutral-50 border-neutral-200',
  // The waiting stages read differently on purpose.
  ask: 'bg-amber-50/60 border-amber-200',
  planning: 'bg-amber-50/60 border-amber-200',
  booked: 'bg-neutral-50 border-neutral-200',
  recorded: 'bg-emerald-50/60 border-emerald-200',
  not_now: 'bg-neutral-50 border-neutral-200',
  closed: 'bg-neutral-50 border-neutral-200',
}

function bandTone(total: number | null): 'green' | 'blue' | 'amber' | 'neutral' {
  if (total === null) return 'neutral'
  const band = bandFor(total)
  return band === 'chase_now' ? 'green' : band === 'strong' ? 'blue' : band === 'fixable' ? 'amber' : 'neutral'
}

function CardTile({ card, href }: { card: BoardCard; href: string }) {
  const { candidate, person, waiting } = card

  return (
    <li>
      <Link
        href={href}
        className="block rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">
            {person?.fullName ?? 'Person record missing'}
          </p>
          {candidate.isAnchor && <StatusBadge label="Anchor" tone="violet" />}
        </div>

        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {person ? [person.roleTitle, person.organisation].filter(Boolean).join(', ') : 'Repair this card'}
        </p>

        {candidate.angle && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-neutral-600">{candidate.angle}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {candidate.scoreTotal !== null ? (
            <StatusBadge label={`${candidate.scoreTotal}/100`} tone={bandTone(candidate.scoreTotal)} />
          ) : (
            <StatusBadge label="Not scored" tone="neutral" />
          )}

          {/* Only the waiting stages count days. */}
          {waiting.label && (
            <StatusBadge
              label={waiting.label}
              tone={waiting.treatAsNo || waiting.stalled ? 'red' : waiting.nudgeDue ? 'amber' : 'neutral'}
            />
          )}
          {waiting.nudgeDue && <StatusBadge label="Nudge due" tone="amber" />}
          {waiting.treatAsNo && <StatusBadge label="Treat as a no" tone="red" />}
          {waiting.stalled && <StatusBadge label="Date has drifted" tone="red" />}
          {candidate.overrideAt && <StatusBadge label="Override" tone="violet" />}
        </div>
      </Link>
    </li>
  )
}

export function OpportunityBoard({
  board,
  config,
  basePath,
}: {
  board: BoardView
  config: PlanningConfig
  basePath: string
}) {
  const live = board.questions.filter((q) => q.status === 'live')
  const grouped = live.length > 0 ? live : board.questions

  if (board.questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-neutral-800">No questions yet.</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-neutral-500">
          The board holds one card per person, grouped by the question they could answer. Start with
          a question — one sentence somebody could disagree with — and the names follow.
        </p>
        <Link
          href={`${basePath}&screen=questions`}
          className="mt-4 inline-block rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Define the first question
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {board.orphanedCards > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {board.orphanedCards} card{board.orphanedCards === 1 ? ' has' : 's have'} no person record —
          either the person asked not to be held, or the record was removed. Open the card to repair
          or close it.
        </p>
      )}

      {grouped.map((question) => {
        const cards = board.cards.filter((c) => c.candidate.questionId === question.id)
        return (
          <section key={question.id} className="space-y-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 pb-2">
              <h2 className="text-base font-semibold text-neutral-900">{question.question}</h2>
              <p className="text-xs text-neutral-500">
                {question.whyNow ? `Why now: ${question.whyNow}` : 'No reason recorded yet'}
              </p>
            </header>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {BOARD_STAGES.map((stage) => {
                const stageCards = rankCandidates(
                  cards.filter((c) => c.candidate.stage === stage).map((c) => c.candidate),
                )
                  .map((candidate) => cards.find((c) => c.candidate.id === candidate.id)!)
                  .filter(Boolean)

                return (
                  <div key={stage} className={`rounded-xl border p-2.5 ${STAGE_TONE[stage]}`}>
                    <div className="mb-2 flex items-baseline justify-between gap-1">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
                        {STAGE_META[stage].label}
                      </h3>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {stage === 'ask'
                          ? `${board.openAskCount}/${config.openAskLimit}`
                          : stageCards.length || ''}
                      </span>
                    </div>

                    {STAGE_META[stage].who === 'waiting' && (
                      <p className="mb-2 text-[11px] leading-4 text-amber-800">Waiting on somebody else</p>
                    )}

                    {stageCards.length === 0 ? (
                      <p className="py-3 text-center text-[11px] text-neutral-400">—</p>
                    ) : (
                      <ul className="space-y-2">
                        {stageCards.map((card) => (
                          <CardTile
                            key={card.candidate.id}
                            card={card}
                            href={`${basePath}&screen=board&card=${card.candidate.id}`}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <footer className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-600">
        <p>
          <strong className="text-neutral-800">Six open asks is the working ceiling</strong> — every
          open request needs following up and every introducer request spends somebody&rsquo;s
          goodwill. Wishlist and Research are unlimited: research as many people as you like, chase a
          handful. Scores are out of 100 and always show their breakdown ·{' '}
          {Object.entries(BAND_META)
            .map(([, meta]) => `${meta.range} ${meta.label.toLowerCase()}`)
            .join(' · ')}
          .
        </p>
      </footer>
    </div>
  )
}
