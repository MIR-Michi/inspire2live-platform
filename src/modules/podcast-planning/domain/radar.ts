import 'server-only'

/**
 * podcast-planning/domain/radar.ts — the two runs.
 *
 * **Find names** (B1): a person asks who could answer a question they have
 * already written. **The scan** (B2): a fortnightly sweep that proposes
 * questions nobody has written yet.
 *
 * Both follow the same three steps, in this order, because the order *is* the
 * architecture (ADR-0016): read the open sources → store what they returned →
 * hand the model a list it did not choose. The model groups and phrases. It
 * never supplies a person, an institution or a date.
 *
 * Every path here reports what it looked at, including the ones that find
 * nothing. A zero-result run that says nothing is indistinguishable from a
 * broken one, and the second time that happens nobody presses the button again.
 */

import { runAiMessage } from '@/kernel/ai-client'
import { OpenAlexError, searchEuropePmc, searchWorks } from '@/kernel/sources'
import type { OpenAlexWork } from '@/kernel/sources'
import type { PodcastQuestion } from '@/modules/podcast-planning/domain/types'
import { toQuestion } from '@/modules/podcast-planning/domain/repository'
import {
  NAMES_SCHEMA,
  NAMES_SYSTEM_PROMPT,
  TOPICS_SCHEMA,
  TOPICS_SYSTEM_PROMPT,
  groundNames,
  groundTopics,
  namesPayload,
  parseJsonReply,
  rejectedExamplesBlock,
  topicsPayload,
} from '@/modules/podcast-planning/domain/radar-grounding'
import {
  dedupeAcrossSources,
  personOptions,
  searchTermsForQuestion,
  signalsFromEuropePmc,
  signalsFromWorks,
  wideningSearches,
  type RadarSignal,
  type RadarSignalInput,
} from '@/modules/podcast-planning/domain/radar-types'
import {
  loadRecentDismissals,
  saveProposal,
  storeSignals,
  type PlanningClient,
} from '@/modules/podcast-planning/domain/radar-repository'
import type { RadarConfig } from '@/modules/podcast-planning/domain/radar-config'

/** How many works one lane pulls back. Enough to see a pattern, few enough to read. */
const WORKS_PER_LANE = 30

/** Below this a query has effectively missed, and is worth widening. */
const MIN_USEFUL_WORKS = 5

/** The most people any single model call may be shown. Beyond this the list stops being a list. */
const MAX_OPTIONS = 60

/**
 * Standing themes, used only when no question carries a tag.
 *
 * Not a topic taxonomy and not configuration: a floor, so a fresh installation
 * with three untagged questions still gets a first scan worth reading. As soon
 * as questions have tags, those win — the scan follows the editorial line
 * rather than a list somebody wrote once.
 */
const FALLBACK_THEMES = [
  'patient involvement research',
  'drug access reimbursement',
  'clinical trial design outcomes',
  'early detection screening',
]

export type FindNamesResult = {
  proposalId: string | null
  /** Records the sources returned. */
  signals: number
  /** Distinct people those records named. */
  candidates: number
  /** People the model put forward and that survived grounding. */
  suggested: number
  /** Suggestions discarded for naming somebody who was not offered. */
  ungrounded: number
  /** Plain-English account of the run, shown whether or not it found anything. */
  message: string
}

// ─── B1: find names for a question that already exists ───────────────────────

/**
 * Suggest people who could answer one question.
 *
 * Runs in front of a person who is waiting, so it takes one lane and one model
 * call, and it is not subject to the spend ceiling — that guards the unattended
 * loop, not somebody paying attention.
 */
export async function runFindNames(
  db: PlanningClient,
  question: PodcastQuestion,
  config: RadarConfig,
  opts: { createdBy?: string | null } = {},
): Promise<FindNamesResult> {
  const search = searchTermsForQuestion(question.question, question.topicTags)
  if (!search) {
    return {
      proposalId: null,
      signals: 0,
      candidates: 0,
      suggested: 0,
      ungrounded: 0,
      message: 'There is nothing searchable in this question yet. Add a few topic tags and try again.',
    }
  }

  const fromDate = isoDaysAgo(config.lookbackDays)
  let works: OpenAlexWork[] = []
  let used = search
  try {
    // Widen until something comes back. The index ANDs every term, so a
    // four-word question can legitimately match nothing while two of its words
    // have a whole literature behind them.
    for (const attempt of wideningSearches(search, config.domainAnchor)) {
      used = attempt
      works = await searchWorks({ search: attempt, fromDate, limit: WORKS_PER_LANE })
      if (works.length >= MIN_USEFUL_WORKS) break
    }
  } catch (error) {
    if (error instanceof OpenAlexError) {
      throw new Error(`The scholarly source could not be reached: ${error.message}`)
    }
    throw error
  }
  const { signals } = await storeSignals(db, signalsFromWorks(works))
  const options = personOptions(signals, { limit: MAX_OPTIONS })

  if (options.length === 0) {
    return {
      proposalId: null,
      signals: signals.length,
      candidates: 0,
      suggested: 0,
      ungrounded: 0,
      message:
        `Searched open scholarly sources for “${used}” since ${fromDate} and found ` +
        `${works.length} paper${works.length === 1 ? '' : 's'}, but no named authors to work from. ` +
        `Widen the date range in settings, or add a name by hand.`,
    }
  }

  const reply = await runAiMessage({
    feature: 'podcast_radar_names',
    workload: 'podcast_radar_names',
    system: NAMES_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          `The question: ${question.question}`,
          question.whyNow ? `Why it matters now: ${question.whyNow}` : null,
          '',
          'The people available, each with the record that named them:',
          namesPayload(options),
        ]
          .filter((line) => line !== null)
          .join('\n'),
      },
    ],
    structuredFormat: {
      type: 'json_schema',
      name: 'radar_names',
      description: 'People from the supplied list who could answer the question.',
      schema: NAMES_SCHEMA,
    },
    maxTokens: 2000,
    retries: 0,
    timeoutMs: 90_000,
    createdBy: opts.createdBy ?? null,
  })

  const parsed = parseJsonReply(reply.output)
  const grounded = groundNames(parsed, options, { limit: config.maxNames })

  if (grounded.names.length === 0) {
    return {
      proposalId: null,
      signals: signals.length,
      candidates: options.length,
      suggested: 0,
      ungrounded: grounded.dropped.unknownRef,
      message:
        `Read ${signals.length} recent paper${signals.length === 1 ? '' : 's'} naming ${options.length} ` +
        `author${options.length === 1 ? '' : 's'}, and none of them was a good enough fit to put forward. ` +
        `That is a real answer, not a failure — this question may need a route other than the literature.`,
    }
  }

  const proposalId = await saveProposal(db, {
    questionId: question.id,
    mode: 'names',
    // A copy, not a reference: the proposal must still read correctly after
    // somebody rewords the question it was made for.
    proposedQuestion: question.question,
    whyNow: question.whyNow,
    whyNowAt: question.whyNowAt,
    signalIds: [...new Set(grounded.names.map((n) => n.signalId))],
    names: grounded.names,
    model: reply.config.model,
    effort: reply.config.effort,
    rawResponse: parsed ?? { unparsed: reply.output.slice(0, 4000) },
    createdBy: opts.createdBy ?? null,
  })

  return {
    proposalId,
    signals: signals.length,
    candidates: options.length,
    suggested: grounded.names.length,
    ungrounded: grounded.dropped.unknownRef,
    message:
      `${grounded.names.length} name${grounded.names.length === 1 ? '' : 's'} from ` +
      `${signals.length} recent paper${signals.length === 1 ? '' : 's'}.`,
  }
}

// ─── B2: the fortnightly scan ────────────────────────────────────────────────

export type ScanResult = {
  lanes: number
  signals: number
  newSignals: number
  proposals: number
  message: string
}

/**
 * The scheduled sweep.
 *
 * Lanes come from the tags on the questions already being asked, so the scan
 * follows the editorial line instead of a fixed taxonomy. Surplus topics are
 * dropped rather than queued: a backlog of unreviewed proposals is the inbox
 * this feature exists to avoid being.
 */
export async function runRadarScan(
  db: PlanningClient,
  config: RadarConfig,
  opts: { onProgress?: (message: string) => Promise<void> } = {},
): Promise<ScanResult> {
  const progress = opts.onProgress ?? (async () => {})

  // Read through the client the caller supplied rather than the module's
  // session reader. A cron has no session, and RLS would hand it zero
  // questions — which looks exactly like an installation with no questions and
  // would silently drop the scan onto the fallback themes.
  const { data: questionRows, error: questionError } = await db
    .from('podcast_questions')
    .select('*')
  if (questionError) throw new Error(`Could not read questions: ${questionError.message}`)
  const questions: PodcastQuestion[] = (questionRows ?? []).map(toQuestion)

  const tags = [
    ...new Set(
      questions
        .filter((q) => q.status !== 'retired')
        .flatMap((q) => q.topicTags)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
  const lanes = (tags.length > 0 ? tags : FALLBACK_THEMES).slice(
    0,
    Math.max(1, config.maxSearchesPerRun),
  )

  const fromDate = isoDaysAgo(config.lookbackDays)
  const collected: RadarSignalInput[] = []
  let failedLanes = 0

  for (const [index, lane] of lanes.entries()) {
    await progress(`Reading open sources: ${index + 1} of ${lanes.length} (${lane}).`)
    // The narrowest anchored form of the lane. A lane is already a chosen
    // phrase, so it is not widened — a tag that finds nothing is a tag
    // nobody should be tagging with.
    const [query] = wideningSearches(lane, config.domainAnchor)

    // Both catalogues, settled independently: Europe PMC being down is not a
    // reason to lose the OpenAlex half of the lane, and vice versa. A lane only
    // counts as failed when both sides of it failed.
    const [works, records] = await Promise.allSettled([
      searchWorks({ search: query, fromDate, limit: WORKS_PER_LANE }),
      searchEuropePmc({ search: query, fromDate, limit: WORKS_PER_LANE }),
    ])

    if (works.status === 'fulfilled') collected.push(...signalsFromWorks(works.value))
    else console.error(`[podcast-planning] OpenAlex lane "${lane}" failed:`, works.reason)

    if (records.status === 'fulfilled') collected.push(...signalsFromEuropePmc(records.value))
    else console.error(`[podcast-planning] Europe PMC lane "${lane}" failed:`, records.reason)

    if (works.status === 'rejected' && records.status === 'rejected') failedLanes += 1
  }

  if (collected.length === 0) {
    return {
      lanes: lanes.length,
      signals: 0,
      newSignals: 0,
      proposals: 0,
      message:
        failedLanes === lanes.length
          ? `All ${lanes.length} source lane${lanes.length === 1 ? '' : 's'} failed. Nothing was read.`
          : `Read ${lanes.length} lane${lanes.length === 1 ? '' : 's'} since ${fromDate} and found nothing new to group.`,
    }
  }

  await progress(`Storing ${collected.length} records.`)
  const { signals, created } = await storeSignals(db, dedupeAcrossSources(collected))
  const recent = onlyRecent(signals, config.lookbackDays)
  const options = personOptions(recent, { limit: MAX_OPTIONS })

  await progress(`Grouping ${recent.length} records into questions.`)
  const reply = await runAiMessage({
    feature: 'podcast_radar_topics',
    workload: 'podcast_radar_topics',
    system: TOPICS_SYSTEM_PROMPT + rejectedExamplesBlock(await loadRecentDismissals(db)),
    // The instructions and the refusals are identical across a run; the records
    // are not. Caching the prefix bills the long half once instead of per lane.
    cacheSystemPrompt: true,
    messages: [
      {
        role: 'user',
        content: [
          'Questions the podcast is already asking (do not propose these again):',
          questions.length > 0
            ? questions.filter((q) => q.status !== 'retired').map((q) => `- ${q.question}`).join('\n')
            : '- none yet',
          '',
          'The records:',
          topicsPayload(recent, options),
          '',
          'The people the records named:',
          namesPayload(options),
        ].join('\n'),
      },
    ],
    structuredFormat: {
      type: 'json_schema',
      name: 'radar_topics',
      description: 'Questions grouped from the supplied records.',
      schema: TOPICS_SCHEMA,
    },
    maxTokens: 6000,
    retries: 0,
    timeoutMs: 180_000,
  })

  const parsed = parseJsonReply(reply.output)
  const grounded = groundTopics(parsed, recent, options, {
    minSources: config.minSources,
    maxTopics: config.maxTopicsPerRun,
    maxNames: config.maxNames,
  })

  let saved = 0
  for (const topic of grounded.topics) {
    await saveProposal(db, {
      questionId: null,
      mode: 'topic',
      proposedQuestion: topic.question,
      whyNow: topic.whyNow,
      whyNowAt: topic.whyNowAt,
      signalIds: topic.signalIds,
      names: topic.names,
      model: reply.config.model,
      effort: reply.config.effort,
      rawResponse: parsed ?? { unparsed: reply.output.slice(0, 4000) },
      createdBy: null,
    })
    saved += 1
  }

  const laneNote = failedLanes > 0 ? ` ${failedLanes} lane${failedLanes === 1 ? '' : 's'} failed.` : ''
  const message =
    saved > 0
      ? `${saved} question${saved === 1 ? '' : 's'} to look at, from ${created} new record${created === 1 ? '' : 's'} across ${lanes.length} lane${lanes.length === 1 ? '' : 's'}.${laneNote}`
      : whyNothing(grounded.dropped, recent.length, config.minSources) + laneNote

  return { lanes: lanes.length, signals: signals.length, newSignals: created, proposals: saved, message }
}

/**
 * Why a scan produced nothing.
 *
 * "Nothing to review" and "the grouping failed" look identical from the
 * outside, and telling them apart is the difference between a quiet fortnight
 * and a feature that has been broken for a month.
 */
function whyNothing(
  dropped: { unknownRef: number; tooFewSources: number; notAQuestion: number },
  recordCount: number,
  minSources: number,
): string {
  if (recordCount === 0) return 'Nothing new was published in these areas since the last scan.'
  if (dropped.tooFewSources > 0 && dropped.notAQuestion === 0) {
    return `Read ${recordCount} records. Nothing reached ${minSources} independent sources yet — the groups that formed were single papers.`
  }
  if (dropped.notAQuestion > 0) {
    return `Read ${recordCount} records. ${dropped.notAQuestion} group${dropped.notAQuestion === 1 ? '' : 's'} came back as a subject area rather than a question and ${dropped.notAQuestion === 1 ? 'was' : 'were'} dropped.`
  }
  return `Read ${recordCount} records and found no group worth proposing.`
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Signals come back from storage including ones a previous run stored, which is
 * what makes the source count honest. The *grouping* input, though, has to be
 * the current window, or every scan would re-propose last quarter's topic.
 */
function onlyRecent(signals: RadarSignal[], lookbackDays: number): RadarSignal[] {
  const cutoff = isoDaysAgo(lookbackDays)
  return signals.filter((s) => !s.publishedAt || s.publishedAt >= cutoff)
}
