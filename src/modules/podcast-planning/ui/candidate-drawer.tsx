/**
 * podcast-planning/ui/candidate-drawer.tsx — the person card.
 *
 * Concept §4: seven blocks, in this order — who and why · score · chance of a
 * yes · route · background · invitations · draft message.
 *
 * A server component. The interactive parts are client components imported from
 * their owning module: the route/introduction controls come from `network`
 * (`RouteExplorer`), so the two-ask protocol lives with the component that owns
 * the relationship, not with the podcast planner.
 */

import Link from 'next/link'
import { StatusBadge } from '@/kernel/ui'
import { RouteExplorer } from '@/modules/network'
import type { NamedRoute, NetworkPerson } from '@/modules/network'
import {
  BAND_META,
  PART_LABELS,
  scoreCandidate,
  summariseScore,
  type ScorePart,
} from '@/modules/podcast-planning/domain/scoring'
import { ROUTE_META } from '@/modules/podcast-planning/domain/types'
import { waitingState } from '@/modules/podcast-planning/domain/stages'
import { STAGE_META } from '@/modules/podcast-planning/domain/stages'
import type {
  Invitation,
  PlanningConfig,
  PodcastQuestion,
  QuestionCandidate,
} from '@/modules/podcast-planning/domain/types'
import { CandidateStageControls } from '@/modules/podcast-planning/ui/candidate-stage-controls'
import { CandidateResearchForm } from '@/modules/podcast-planning/ui/candidate-research-form'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-neutral-200 pt-4 first:border-0 first:pt-0">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
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

  return (
    <aside className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {STAGE_META[candidate.stage].label}
            {waiting.label ? ` · ${waiting.label}` : ''}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">
            {person?.fullName ?? 'Person record missing'}
          </h2>
          <p className="text-sm text-neutral-600">
            {person
              ? [person.roleTitle, person.organisation, person.country].filter(Boolean).join(' · ')
              : 'This card points at a person who has objected or been removed. Close it or point it at somebody else.'}
          </p>
        </div>
        <Link
          href={closeHref}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
        >
          Close
        </Link>
      </header>

      {/* 1 — Who and why */}
      <Block
        title="Who and why"
        hint="What this person can say that nobody else on this wishlist can."
      >
        {candidate.angle ? (
          <p className="text-sm leading-6 text-neutral-800">{candidate.angle}</p>
        ) : (
          <p className="text-sm text-amber-900">
            No angle yet. &ldquo;Senior and works in this field&rdquo; is not an angle — without one
            the card belongs back on the wishlist.
          </p>
        )}
        {candidate.isAnchor && (
          <p className="text-xs text-violet-800">
            Anchor for this question: their acceptance makes every other invitation easier.
          </p>
        )}
      </Block>

      {/* 2 — Score */}
      <Block title="Score" hint={summariseScore(score)}>
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-semibold text-neutral-900">{score.total}</p>
          <StatusBadge
            label={`${BAND_META[score.band].label} · ${BAND_META[score.band].range}`}
            tone={score.band === 'chase_now' ? 'green' : score.band === 'strong' ? 'blue' : score.band === 'fixable' ? 'amber' : 'neutral'}
          />
        </div>
        <p className="text-xs text-neutral-500">{BAND_META[score.band].advice}</p>

        <ul className="mt-2 space-y-1.5">
          {parts.map((part) => {
            const item = score.breakdown[part]
            const pct = item.max > 0 ? Math.round((item.points / item.max) * 100) : 0
            return (
              <li key={part} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-xs">
                <span className="text-neutral-600">{PART_LABELS[part]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full bg-neutral-800"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-right font-semibold text-neutral-800">
                  {item.points}/{item.max}
                </span>
              </li>
            )
          })}
        </ul>

        {candidate.overrideAt && (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
            Pushed to the top deliberately: {candidate.overrideReason}. Recorded rather than hidden —
            an override that keeps being right is evidence the model is wrong, not the person.
          </p>
        )}
      </Block>

      {/* 3 — Chance of a yes */}
      <Block
        title="Chance of a yes"
        hint="A perfect question with an unreachable guest produces no episode at all."
      >
        <p className="text-sm font-semibold text-neutral-900">
          {score.chanceOfYes} / 25
        </p>
        <ul className="space-y-1 text-xs text-neutral-600">
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
      </Block>

      {/* 4 — Route */}
      <Block
        title="Route"
        hint={candidate.route ? ROUTE_META[candidate.route].approach : 'No route chosen yet.'}
      >
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
      </Block>

      {/* 5 — Background */}
      <Block title="Background" hint="Source-linked, so anything unverified stays out of the score.">
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
              <p className="text-xs text-neutral-500">
                No podcast appearance found — the single fact that predicts a yes better than
                anything else the platform can know.
              </p>
            )}
            {candidate.priorRefusal !== 'none' && (
              <p className="text-xs text-amber-900">
                Said no before ({candidate.priorRefusal.replace('_', ' ')}
                {candidate.priorRefusalAt ? `, ${candidate.priorRefusalAt}` : ''}).
              </p>
            )}
            {person.industryRelationship && (
              <p className="text-xs text-violet-900">
                Industry relationship: {person.industryRelationship} — visible at booking time rather
                than discovered later.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Nothing to show.</p>
        )}
      </Block>

      {/* 6 — Invitations */}
      <Block title="Invitations" hint="Every attempt so far, and what came back.">
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
      </Block>

      {/* 7 — Research and the stage controls */}
      <Block
        title="Research and next move"
        hint="An angle, a route and a score are what let a card be asked."
      >
        <CandidateResearchForm candidate={candidate} />
        <CandidateStageControls
          candidate={candidate}
          question={question}
          openAskCount={openAskCount}
          config={config}
        />
      </Block>
    </aside>
  )
}
