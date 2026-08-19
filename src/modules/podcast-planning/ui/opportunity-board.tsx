/**
 * podcast-planning/ui/opportunity-board.tsx — the six-stage board.
 *
 * Concept §3 and §4, re-cut in the 2026-08 UX pass: as little text as the
 * meaning allows. Three things this layout has to get right:
 *
 *  - **The next action is handed to you.** The "Next up" strip surfaces every
 *    card the domain says needs a decision (nudge due, silence past the cut-off,
 *    a stalled booking, a sleeper due to wake) so nobody scans six columns to
 *    find their work.
 *  - **Waiting is not to-do.** Ask and Planning are tinted and carry a clock,
 *    because a card you are waiting on is a different problem from a card you
 *    owe work on.
 *  - **The ceiling is visible before it bites.** The Ask column header counts
 *    the allowed open asks, so the limit reads as a working practice rather
 *    than an error at click time.
 */

import Link from 'next/link'
import { BOARD_STAGES, STAGE_META, dueToWake } from '@/modules/podcast-planning/domain/stages'
import { BAND_META, bandFor, rankCandidates } from '@/modules/podcast-planning/domain/scoring'
import type { CandidateStage, PlanningConfig } from '@/modules/podcast-planning/domain/types'
import type { BoardCard, BoardView } from '@/modules/podcast-planning/domain/repository'
import {
  IconArrowRight,
  IconClock,
  IconOverride,
  IconQuestion,
  IconStar,
  InitialsAvatar,
  STAGE_ICONS,
} from '@/modules/podcast-planning/ui/icons'

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

const BAND_DOT: Record<string, string> = {
  chase_now: 'bg-emerald-500',
  strong: 'bg-blue-500',
  fixable: 'bg-amber-500',
  leave_it: 'bg-neutral-300',
}

/** The score, reduced to a dot and a number — the band colour carries the advice. */
function ScoreDot({ total }: { total: number | null }) {
  if (total === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-neutral-300" />
        —
      </span>
    )
  }
  const band = bandFor(total)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700"
      title={`${BAND_META[band].label} (${BAND_META[band].range})`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${BAND_DOT[band]}`} />
      {total}
    </span>
  )
}

/** At most one status pill per card — the most urgent thing wins. */
function UrgencyPill({ card }: { card: BoardCard }) {
  const { waiting } = card
  if (waiting.treatAsNo)
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">No reply</span>
  if (waiting.stalled)
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Stalled</span>
  if (waiting.nudgeDue)
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Nudge</span>
  if (waiting.days !== null)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
        <IconClock className="h-3 w-3" />
        {waiting.days}d
      </span>
    )
  return null
}

function CardTile({ card, href }: { card: BoardCard; href: string }) {
  const { candidate, person } = card

  return (
    <li>
      <Link
        href={href}
        className="block rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
      >
        <div className="flex items-center gap-2.5">
          <InitialsAvatar name={person?.fullName ?? null} className="h-9 w-9 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
              <span className="truncate">{person?.fullName ?? 'Needs repair'}</span>
              {candidate.isAnchor && (
                <IconStar filled className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              )}
              {candidate.overrideAt && (
                <IconOverride className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              )}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {person ? [person.roleTitle, person.organisation].filter(Boolean).join(', ') : '—'}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <ScoreDot total={candidate.scoreTotal} />
          <UrgencyPill card={card} />
        </div>
      </Link>
    </li>
  )
}

/**
 * The cards the domain says need a decision today, in one glanceable strip.
 * Empty means quiet — the strip disappears entirely.
 */
function NextUpStrip({
  cards,
  basePath,
}: {
  cards: Array<{ card: BoardCard; reason: string; tone: 'red' | 'amber' | 'blue' }>
  basePath: string
}) {
  if (cards.length === 0) return null

  const pill: Record<'red' | 'amber' | 'blue', string> = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-50 text-blue-700',
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
        <IconArrowRight className="h-3.5 w-3.5" />
        Next up
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {cards.map(({ card, reason, tone }) => (
          <li key={card.candidate.id} className="shrink-0">
            <Link
              href={`${basePath}&screen=board&card=${card.candidate.id}`}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              <InitialsAvatar name={card.person?.fullName ?? null} className="h-7 w-7 text-[10px]" />
              <span className="max-w-[10rem] truncate text-sm font-semibold text-neutral-800">
                {card.person?.fullName ?? 'Needs repair'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill[tone]}`}>
                {reason}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
        <IconQuestion className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-neutral-800">Start with a question</p>
        <p className="mt-1 text-sm text-neutral-500">The names follow.</p>
        <Link
          href={`${basePath}&screen=questions`}
          className="mt-4 inline-block rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          + New question
        </Link>
      </div>
    )
  }

  // What needs a decision, most urgent first — same priorities as boardAgenda.
  const agenda: Array<{ card: BoardCard; reason: string; tone: 'red' | 'amber' | 'blue' }> = []
  for (const card of board.cards) {
    if (card.waiting.treatAsNo) agenda.push({ card, reason: 'No reply', tone: 'red' })
    else if (card.waiting.stalled) agenda.push({ card, reason: 'Stalled', tone: 'red' })
    else if (card.waiting.nudgeDue) agenda.push({ card, reason: 'Nudge due', tone: 'amber' })
  }
  const wakeIds = new Set(dueToWake(board.cards.map((c) => c.candidate)).map((c) => c.id))
  for (const card of board.cards) {
    if (wakeIds.has(card.candidate.id)) agenda.push({ card, reason: 'Wake up', tone: 'blue' })
  }

  return (
    <div className="space-y-6">
      <NextUpStrip cards={agenda} basePath={basePath} />

      {board.orphanedCards > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {board.orphanedCards} card{board.orphanedCards === 1 ? '' : 's'} without a person — open to
          repair or close.
        </p>
      )}

      {grouped.map((question) => {
        const cards = board.cards.filter((c) => c.candidate.questionId === question.id)
        return (
          <section key={question.id} className="space-y-3">
            <header className="border-b border-neutral-200 pb-2">
              <h2 className="text-base font-semibold text-neutral-900">{question.question}</h2>
              {question.whyNow && (
                <p className="mt-0.5 truncate text-xs text-neutral-400">{question.whyNow}</p>
              )}
            </header>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {BOARD_STAGES.map((stage, index) => {
                const StageIcon = STAGE_ICONS[stage]
                const stageCards = rankCandidates(
                  cards.filter((c) => c.candidate.stage === stage).map((c) => c.candidate),
                )
                  .map((candidate) => cards.find((c) => c.candidate.id === candidate.id)!)
                  .filter(Boolean)

                const waitingStage = STAGE_META[stage].who === 'waiting'

                return (
                  <div key={stage} className={`rounded-xl border p-2.5 ${STAGE_TONE[stage]}`}>
                    <div
                      className="mb-2 flex items-center justify-between gap-1"
                      title={`${index + 1}. ${STAGE_META[stage].label} — ${STAGE_META[stage].description}`}
                    >
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
                        <StageIcon className={`h-3.5 w-3.5 ${waitingStage ? 'text-amber-600' : 'text-neutral-400'}`} />
                        {STAGE_META[stage].label}
                        {waitingStage && <IconClock className="h-3 w-3 text-amber-600" />}
                      </h3>
                      <span className="text-[11px] font-medium text-neutral-500">
                        {stage === 'ask'
                          ? `${board.openAskCount}/${config.openAskLimit}`
                          : stageCards.length || ''}
                      </span>
                    </div>

                    {stageCards.length === 0 ? (
                      <p className="py-3 text-center text-[11px] text-neutral-300">·</p>
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

      {/* The whole scoring philosophy, reduced to a legend. */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-neutral-500">
        {(Object.keys(BAND_META) as Array<keyof typeof BAND_META>).map((band) => (
          <span key={band} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${BAND_DOT[band]}`} />
            {BAND_META[band].range} {BAND_META[band].label.toLowerCase()}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <IconClock className="h-3 w-3 text-amber-600" />
          waiting on somebody else
        </span>
        <span className="inline-flex items-center gap-1.5">
          <IconStar filled className="h-3 w-3 text-violet-500" />
          anchor
        </span>
      </footer>
    </div>
  )
}
