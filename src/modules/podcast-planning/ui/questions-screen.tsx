/**
 * podcast-planning/ui/questions-screen.tsx — the Questions screen.
 *
 * Concept §2 and §4. A question is not opened until four things are written
 * down, and this screen is where that happens. It shows the readiness gate
 * openly — "still missing: the listener action" — rather than silently refusing
 * a move on the board later, because the twenty minutes spent here is what
 * determines everything downstream.
 */

import { StatusBadge } from '@/kernel/ui'
import { ASK_META, FORMAT_META } from '@/modules/podcast-planning/domain/types'
import { questionReadiness } from '@/modules/podcast-planning/domain/stages'
import type { PlanningConfig } from '@/modules/podcast-planning/domain/types'
import type { QuestionSummary } from '@/modules/podcast-planning/domain/question-summary'
import { QuestionComposer } from '@/modules/podcast-planning/ui/question-composer'

export function QuestionsScreen({
  summaries,
  config,
  owners,
}: {
  summaries: QuestionSummary[]
  config: PlanningConfig
  owners: Array<{ id: string; label: string }>
}) {
  const liveCount = summaries.filter((s) => s.question.status === 'live').length

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">Live questions</h2>
          <p className="text-xs text-neutral-500">
            {liveCount} of {config.liveQuestionLimit} live
          </p>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">
          A question is the thing the podcast is asking — one sentence somebody could disagree with,
          not a subject area. It lives for months and survives any number of people saying no, which
          is why the card that moves on the board is the <em>person</em>, not the question.
        </p>
      </section>

      <QuestionComposer owners={owners} />

      {summaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
          No questions yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {summaries.map(({ question, wishlistSize, inPlay, episodes, anchorSecured }) => {
            const readiness = questionReadiness(question)
            return (
              <li
                key={question.id}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900">{question.question}</h3>
                    {question.whyNow && (
                      <p className="mt-1 text-sm text-neutral-600">
                        <span className="font-medium text-neutral-700">Why now:</span> {question.whyNow}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <StatusBadge
                      label={question.status}
                      tone={question.status === 'live' ? 'green' : question.status === 'draft' ? 'amber' : 'neutral'}
                    />
                    {anchorSecured && <StatusBadge label="Anchor secured" tone="violet" />}
                  </div>
                </div>

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Wishlist</dt>
                    <dd className="font-semibold text-neutral-900">{wishlistSize}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">In play</dt>
                    <dd className="font-semibold text-neutral-900">{inPlay}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Episodes</dt>
                    <dd className="font-semibold text-neutral-900">{episodes}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-neutral-400">Format</dt>
                    <dd className="font-semibold text-neutral-900">
                      {question.format ? FORMAT_META[question.format].label : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 border-t border-neutral-100 pt-3 text-sm">
                  {readiness.ready ? (
                    <p className="text-neutral-600">
                      <span className="font-medium text-neutral-800">The ask:</span>{' '}
                      {question.askType ? ASK_META[question.askType].label : ''} →{' '}
                      <span className="break-all text-neutral-500">{question.askDestinationUrl}</span>
                      {question.askVerifiedAt ? (
                        <StatusBadge label="Destination checked" tone="green" />
                      ) : (
                        <span className="ml-2 text-amber-800">
                          not checked — an ask pointing at a broken page wastes the episode
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-amber-900">
                      <span className="font-semibold">Not ready for names.</span> Still missing:{' '}
                      {readiness.missing.join(', ')}. No candidate on this question can leave the
                      wishlist until it is complete.
                    </p>
                  )}
                </div>

                {wishlistSize < 5 && readiness.ready && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Most invitations fail. Ten to twenty names on a question makes a no an
                    inconvenience rather than a restart.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
