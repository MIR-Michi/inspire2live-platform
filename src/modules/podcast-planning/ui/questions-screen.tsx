/**
 * podcast-planning/ui/questions-screen.tsx — the Questions screen.
 *
 * Concept §2 and §4, re-cut in the 2026-08 UX pass. A question is not opened
 * until four things are written down; instead of explaining that in prose, the
 * card shows the gate as five check-chips — what is done is green, what is
 * missing is an empty circle, and a question that is not ready wears one amber
 * pill. Filling the checks *is* the twenty minutes that determines everything
 * downstream.
 */

import { StatusBadge } from '@/kernel/ui'
import { ASK_META, FORMAT_META } from '@/modules/podcast-planning/domain/types'
import type { PodcastQuestion, PlanningConfig } from '@/modules/podcast-planning/domain/types'
import type { QuestionSummary } from '@/modules/podcast-planning/domain/question-summary'
import { QuestionEditor } from '@/modules/podcast-planning/ui/question-editor'
import { FindNamesButton } from '@/modules/podcast-planning/ui/find-names-button'
import { VerifyAskButton } from '@/modules/podcast-planning/ui/verify-ask-button'
import { IconCheck, IconStar } from '@/modules/podcast-planning/ui/icons'

/** The readiness gate, one chip per requirement. Mirrors `questionReadiness`. */
function ReadinessChips({ question }: { question: PodcastQuestion }) {
  const checks: Array<{ label: string; done: boolean }> = [
    { label: 'Question', done: Boolean(question.question?.trim()) },
    { label: 'Why now', done: Boolean(question.whyNow?.trim()) },
    { label: 'Action', done: Boolean(question.askType) },
    { label: 'Link', done: Boolean(question.askDestinationUrl?.trim()) },
    { label: 'Format', done: Boolean(question.format) },
  ]

  return (
    <ul className="flex flex-wrap gap-1.5">
      {checks.map(({ label, done }) => (
        <li
          key={label}
          className={[
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            done
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-neutral-200 bg-white text-neutral-400',
          ].join(' ')}
        >
          {done ? (
            <IconCheck className="h-3 w-3" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-neutral-300" />
          )}
          {label}
        </li>
      ))}
    </ul>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-sm">
      <span className="font-semibold text-neutral-900">{value}</span>
      <span className="text-xs text-neutral-400">{label}</span>
    </span>
  )
}

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
          {liveCount}/{config.liveQuestionLimit} live
        </span>
        <QuestionEditor owners={owners} />
      </div>

      {summaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
          No questions yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {summaries.map(({ question, wishlistSize, inPlay, episodes, totalCards, anchorSecured }) => {
            const ready =
              Boolean(question.question?.trim()) &&
              Boolean(question.whyNow?.trim()) &&
              Boolean(question.askType) &&
              Boolean(question.askDestinationUrl?.trim()) &&
              Boolean(question.format)
            return (
              <li
                key={question.id}
                className="space-y-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900">{question.question}</h3>
                    {question.whyNow && (
                      <p className="mt-0.5 truncate text-xs text-neutral-400">{question.whyNow}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <StatusBadge
                      label={question.status}
                      tone={question.status === 'live' ? 'green' : question.status === 'draft' ? 'amber' : 'neutral'}
                    />
                    {!ready && <StatusBadge label="Not ready" tone="amber" />}
                    {anchorSecured && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        <IconStar filled className="h-3 w-3" />
                        Anchor
                      </span>
                    )}
                  </div>
                </div>

                <ReadinessChips question={question} />

                {/* Shown because they are not decoration: tags replace the
                    question's own words in the guest search, so a question with
                    none is searched by whatever nouns its sentence happens to
                    contain. Seeing that is how somebody knows to fix it. */}
                <ul className="flex flex-wrap items-center gap-1.5">
                  {question.topicTags.length > 0 ? (
                    question.topicTags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
                      >
                        {tag}
                      </li>
                    ))
                  ) : (
                    <li className="text-[11px] text-neutral-400">
                      No topics — the guest search will fall back to the wording of the question.
                    </li>
                  )}
                </ul>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-neutral-100 pt-3">
                  <Stat value={wishlistSize} label="wishlist" />
                  <Stat value={inPlay} label="in play" />
                  <Stat value={episodes} label="episodes" />
                  {/* The board's front door. Offered on every question that is
                      still being worked, and loudest on an empty wishlist —
                      which is the state where nothing else on this card helps. */}
                  {question.status !== 'retired' && (
                    <FindNamesButton
                      questionId={question.id}
                      label={wishlistSize === 0 ? 'Suggest guests' : 'Suggest more'}
                      className="flex flex-wrap items-center gap-2"
                    />
                  )}
                  <QuestionEditor owners={owners} question={question} totalCards={totalCards} />
                  {question.format && (
                    <span className="text-xs font-medium text-neutral-500">
                      {FORMAT_META[question.format].label}
                    </span>
                  )}
                  {ready && question.askType && (
                    <span className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
                      {ASK_META[question.askType].label} →
                      <span className="max-w-[14rem] truncate">{question.askDestinationUrl}</span>
                      {question.askVerifiedAt ? (
                        <IconCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <VerifyAskButton questionId={question.id} />
                      )}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
