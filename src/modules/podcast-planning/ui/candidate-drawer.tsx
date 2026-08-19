/**
 * podcast-planning/ui/candidate-drawer.tsx — the person card.
 *
 * Re-cut in the 2026-08 UX pass. The old drawer was seven prose blocks; this
 * one is a hierarchy: **who → where in the pipeline → the one next move**,
 * always visible, and everything explanatory folded underneath. A server
 * component; the interactive parts are client components imported from their
 * owning module (`RouteExplorer` comes from `network`, so the two-ask protocol
 * lives with the component that owns the relationship).
 */

import Link from 'next/link'
import { RouteExplorer } from '@/modules/network'
import type { NamedRoute, NetworkPerson } from '@/modules/network'
import {
  BAND_META,
  PART_LABELS,
  scoreCandidate,
  type ScorePart,
} from '@/modules/podcast-planning/domain/scoring'
import { BOARD_STAGES, STAGE_META, waitingState } from '@/modules/podcast-planning/domain/stages'
import type {
  Invitation,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import { CandidateStageControls } from '@/modules/podcast-planning/ui/candidate-stage-controls'
import { CandidateResearchForm } from '@/modules/podcast-planning/ui/candidate-research-form'
import {
  IconChevron,
  IconClock,
  IconSleep,
  IconClose,
  IconStar,
  InitialsAvatar,
  STAGE_ICONS,
} from '@/modules/podcast-planning/ui/icons'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

const BAND_TONE: Record<string, string> = {
  chase_now: 'bg-emerald-50 text-emerald-700',
  strong: 'bg-blue-50 text-blue-700',
  fixable: 'bg-amber-100 text-amber-800',
  leave_it: 'bg-neutral-100 text-neutral-600',
}

/** Where this card sits in the pipeline, as a glanceable dot row. */
function StageStepper({ stage }: { stage: QuestionCandidate['stage'] }) {
  if (stage === 'not_now' || stage === 'closed') {
    const Icon = stage === 'not_now' ? IconSleep : IconClose
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
        <Icon className="h-3.5 w-3.5" />
        {STAGE_META[stage].label}
      </p>
    )
  }

  const activeIndex = BOARD_STAGES.indexOf(stage)
  return (
    <ol className="flex items-center" aria-label={`Stage: ${STAGE_META[stage].label}`}>
      {BOARD_STAGES.map((s, index) => {
        const Icon = STAGE_ICONS[s]
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo'
        return (
          <li key={s} className="flex items-center" title={STAGE_META[s].label}>
            {index > 0 && (
              <span
                className={`h-0.5 w-3 sm:w-4 ${state === 'todo' ? 'bg-neutral-200' : 'bg-neutral-800'}`}
              />
            )}
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full border',
                state === 'active'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : state === 'done'
                    ? 'border-neutral-800 bg-white text-neutral-800'
                    : 'border-neutral-200 bg-white text-neutral-300',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** A folded section: icon-free summary line, chevron, details underneath. */
function Fold({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group border-t border-neutral-200 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <IconChevron className="h-3.5 w-3.5 text-neutral-400 transition-transform group-open:rotate-90" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {title}
        </span>
        {badge}
      </summary>
      <div className="mt-2.5 space-y-2">{children}</div>
    </details>
  )
}

export function CandidateDrawer({
  candidate,
  question,
  person,
  routes,
  invitations,
  config,
  openAskCount,
  closeHref,
}: {
  candidate: QuestionCandidate
  question: PodcastQuestion
  person: NetworkPerson | null
  routes: NamedRoute[]
  invitations: Invitation[]
  config: PlanningConfig
  openAskCount: number
  closeHref: string
}) {
  const score = scoreCandidate(candidate, question, {
    institutionalFriction: person?.institutionalFriction ?? 'none',
    sharesOwnAppearances: person?.sharesOwnAppearances ?? null,
    config,
  })
  const waiting = waitingState(candidate, { config })
  const parts = Object.keys(PART_LABELS) as ScorePart[]
  const researchOpen = candidate.stage === 'wishlist' || candidate.stage === 'research'

  return (
    <aside className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg">
      {/* Who */}
      <header className="flex items-start gap-3">
        <InitialsAvatar name={person?.fullName ?? null} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-neutral-900">
            <span className="truncate">{person?.fullName ?? 'Needs repair'}</span>
            {candidate.isAnchor && (
              <IconStar filled className="h-4 w-4 shrink-0 text-violet-500" />
            )}
          </h2>
          <p className="truncate text-sm text-neutral-500">
            {person
              ? [person.roleTitle, person.organisation, person.country].filter(Boolean).join(' · ')
              : 'The person objected or was removed — close this card or repoint it.'}
          </p>
        </div>
        <Link
          href={closeHref}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Link>
      </header>

      {/* Where in the pipeline */}
      <div className="flex flex-wrap items-center gap-2.5">
        <StageStepper stage={candidate.stage} />
        {waiting.days !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              waiting.treatAsNo || waiting.stalled
                ? 'bg-red-50 text-red-700'
                : waiting.nudgeDue
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            <IconClock className="h-3 w-3" />
            {waiting.days}d
          </span>
        )}
      </div>

      {/* The next move */}
      <CandidateStageControls
        candidate={candidate}
        question={question}
        openAskCount={openAskCount}
        config={config}
      />

      {/* The angle is the card's one sentence — visible, not folded. */}
      {candidate.angle ? (
        <blockquote className="border-l-2 border-neutral-300 pl-3 text-sm leading-6 text-neutral-700">
          {candidate.angle}
        </blockquote>
      ) : (
        <p className="text-sm text-amber-900">No angle yet — what can only this person say?</p>
      )}

      {/* Score: number + band always; the arithmetic folded. */}
      <div className="flex items-center gap-3">
        <p className="text-3xl font-semibold leading-none text-neutral-900">{score.total}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BAND_TONE[score.band]}`}>
          {BAND_META[score.band].label}
        </span>
        <div className="ml-auto flex items-end gap-1" aria-hidden="true">
          {parts.map((part) => {
            const item = score.breakdown[part]
            const pct = item.max > 0 ? item.points / item.max : 0
            return (
              <span
                key={part}
                title={`${PART_LABELS[part]}: ${item.points}/${item.max}`}
                className="flex h-8 w-2.5 items-end overflow-hidden rounded-sm bg-neutral-100"
              >
                <span
                  className="block w-full rounded-sm bg-neutral-800"
                  style={{ height: `${Math.max(pct * 100, 6)}%` }}
                />
              </span>
            )
          })}
        </div>
      </div>

      <Fold title="Why this score">
        <p className="text-xs text-neutral-500">{BAND_META[score.band].advice}</p>
        <ul className="space-y-1.5">
          {parts.map((part) => {
            const item = score.breakdown[part]
            const pct = item.max > 0 ? Math.round((item.points / item.max) * 100) : 0
            return (
              <li key={part} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-xs">
                <span className="text-neutral-600">{PART_LABELS[part]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <span className="block h-full rounded-full bg-neutral-800" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right font-semibold text-neutral-800">
                  {item.points}/{item.max}
                </span>
              </li>
            )
          })}
        </ul>
        <ul className="space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
          {score.breakdown.chanceOfYes.lines.map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-3">
              <span>
                {line.label} — <span className="text-neutral-500">{line.note}</span>
              </span>
              <span className={`shrink-0 font-semibold ${line.points < 0 ? 'text-red-700' : 'text-neutral-800'}`}>
                {line.points > 0 ? '+' : ''}
                {line.points}
              </span>
            </li>
          ))}
        </ul>
        {candidate.overrideAt && (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
            Pushed to the top deliberately: {candidate.overrideReason}
          </p>
        )}
      </Fold>

      <Fold title="Research" defaultOpen={researchOpen}>
        <CandidateResearchForm candidate={candidate} />
      </Fold>

      <Fold title="Route" defaultOpen={!candidate.route}>
        {person ? (
          <RouteExplorer
            personId={person.id}
            personName={person.fullName}
            routes={routes}
            contextType="podcast_candidate"
            contextId={candidate.id}
            contextSummary={`an episode on ${question.question}`}
          />
        ) : (
          <p className="text-sm text-neutral-500">No person to route to.</p>
        )}
      </Fold>

      <Fold title="Background">
        {person ? (
          <div className="space-y-2 text-sm text-neutral-700">
            {person.whatTheyCanSay && <p>{person.whatTheyCanSay}</p>}
            {person.appearances.length > 0 ? (
              <ul className="space-y-1 text-xs text-neutral-600">
                {person.appearances.map((appearance, index) => (
                  <li key={index}>
                    {appearance.show}
                    {appearance.publishedAt ? ` · ${appearance.publishedAt}` : ''}
                    {appearance.url ? (
                      <a href={appearance.url} className="ml-1 text-blue-800 underline" rel="noreferrer">
                        source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500">No podcast appearance found.</p>
            )}
            {candidate.priorRefusal !== 'none' && (
              <p className="text-xs text-amber-900">
                Said no before ({candidate.priorRefusal.replace('_', ' ')}
                {candidate.priorRefusalAt ? `, ${candidate.priorRefusalAt}` : ''}).
              </p>
            )}
            {person.industryRelationship && (
              <p className="text-xs text-violet-900">Industry relationship: {person.industryRelationship}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Nothing to show.</p>
        )}
      </Fold>

      <Fold
        title="Invitations"
        badge={
          invitations.length > 0 ? (
            <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-600">
              {invitations.length}
            </span>
          ) : undefined
        }
      >
        {invitations.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-800">
                    {invitation.kind === 'introduction' ? 'Through an introducer' : 'Direct'}
                  </span>
                  <span className="text-neutral-500">{formatDate(invitation.sentAt)}</span>
                </div>
                <p className="mt-1 text-neutral-600">
                  {invitation.response
                    ? `Answer: ${invitation.response.replace('_', ' ')}`
                    : invitation.nudgedAt
                      ? `Nudged ${formatDate(invitation.nudgedAt)} — no answer yet`
                      : 'Waiting'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Fold>
    </aside>
  )
}
