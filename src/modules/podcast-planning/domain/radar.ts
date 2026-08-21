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
import { searchEuropePmc, searchWorks } from '@/kernel/sources'
import type { PodcastQuestion } from '@/modules/podcast-planning/domain/types'
import { toQuestion } from '@/modules/podcast-planning/domain/repository'
import {
  NAMES_SCHEMA,
  NAMES_SYSTEM_PROMPT,
  TOPICS_SCHEMA,
  TOPICS_SYSTEM_PROMPT,
  fillToFloor,
  groundNames,
  groundTopics,
  namesPayload,
  parseJsonReply,
  rejectedExamplesBlock,
  topicsPayload,
  unparsedReply,
} from '@/modules/podcast-planning/domain/radar-grounding'
import {
  dedupeAcrossSources,
  normalisePersonName,
  personOptions,
  radarDedupeKey,
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

/** How many works one scan lane pulls back. Enough to see a pattern, few enough to read. */
const WORKS_PER_LANE = 30

/**
 * How many works one "Find names" query pulls back.
 *
 * Europe PMC allows 100 per page and OpenAlex 200; asking for thirty was a
 * guess made when the loop stopped at the first query that returned anything.
 * Now that the run accumulates and stops on *people*, a bigger page is simply a
 * better first attempt, and usually the only one needed.
 */
const WORKS_PER_FIND = 100

/**
 * Distinct named people that make a list worth ranking.
 *
 * The stop rule used to be five *papers*, which is how a run settled on a query
 * that returned five irrelevant results and never widened again. Counting the
 * thing the model is actually handed makes the ladder stop for the right reason.
 */
const TARGET_PEOPLE = 30

/**
 * The shortlist "Suggest guests" tries to fill.
 *
 * A screen that answers "nobody" when thirty cited authors were retrieved is
 * not being rigorous, it is being unhelpful. Where the retrieved list allows it,
 * this many names are always shown — see `fillToFloor`.
 */
const TARGET_NAMES = 10

/** The most source round trips one click may make. Two catalogues per attempt. */
const MAX_ATTEMPTS = 8

/**
 * The most records one click may store.
 *
 * A ceiling on the read-back `.in('dedupe_key', …)` as much as on anything else:
 * every key travels in the query string, and a few hundred is where that stops
 * being free. Three hundred papers name far more people than a shortlist needs.
 */
const MAX_RECORDS_PER_FIND = 300

/** The most people any single model call may be shown. Beyond this the list stops being a list. */
const MAX_OPTIONS = 60

/**
 * How far back a query is retried when the configured window returns nothing.
 *
 * A fixed 120 days is right for the fortnightly scan, whose job is to notice
 * what is new, and wrong for a person asking who could answer a question they
 * already have. Measured against Europe PMC: the Brazil-specific CAR-T query
 * returns nothing at 120 days, nothing at a year, and one paper over three —
 * "Challenges and Pathways in Regulating Next-Gen Biological Therapies", which
 * is squarely the question and names five people. Three years is where an
 * access or policy question's literature actually lives.
 */
const DEEP_LOOKBACK_DAYS = 1095

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

/** A rejected promise carries `unknown`; the message is the only part worth keeping. */
function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

export type FindNamesResult = {
  proposalId: string | null
  /** Records the sources returned. */
  signals: number
  /** Distinct people those records named. */
  candidates: number
  /** Names on the proposal, including any added to reach the floor. */
  suggested: number
  /** Of those, how many carry no editorial angle because the model did not reach them. */
  unassessed: number
  /** Suggestions discarded for naming somebody who was not offered. */
  ungrounded: number
  /** Plain-English account of the run, shown whether or not it found anything. */
  message: string
}

const NOTHING: Omit<FindNamesResult, 'message'> = {
  proposalId: null,
  signals: 0,
  candidates: 0,
  suggested: 0,
  unassessed: 0,
  ungrounded: 0,
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
      ...NOTHING,
      message:
        'There is nothing specific enough to search for in this question yet — it is all verbs and ' +
        'judgements, with no subject a catalogue could match. Add a topic tag or two and try again.',
    }
  }

  // ── Retrieval. Accumulate across every attempt rather than keeping only the
  // last: a narrow query that returns three papers squarely on the question and
  // a broad one that returns eighty around it are both worth having, and the
  // previous version threw the first away when it ran the second.
  const queries = wideningSearches(search, config.domainAnchor)
  const baseWindow = config.lookbackDays
  const deepWindow = Math.max(config.lookbackDays, DEEP_LOOKBACK_DAYS)

  const collected: RadarSignalInput[] = []
  const seenRecords = new Set<string>()
  const seenPeople = new Set<string>()
  /**
   * Dedupe key → the rung of the widening ladder that found it. Carried into
   * `personOptions`, where it outranks weight of evidence: the people named by
   * the narrowest query that returned anything are the people most nearly about
   * the question, and there are usually very few of them.
   */
  const closenessByRecord = new Map<string, number>()
  const trace: string[] = []
  let attempts = 0
  let answered = false
  let oneSourceDown = false
  let lastFailure: Error | null = null
  let used = queries[0] ?? search
  let usedFrom = isoDaysAgo(baseWindow)

  // Read through a function: `lastFailure` is only ever assigned inside the
  // attempt closure, which control-flow analysis cannot see, so a direct read
  // would be narrowed to `null`.
  const failureMessage = () => lastFailure?.message ?? 'unknown error'

  const enough = () =>
    seenPeople.size >= TARGET_PEOPLE || collected.length >= MAX_RECORDS_PER_FIND

  function collect(inputs: RadarSignalInput[], rung: number): void {
    for (const input of inputs) {
      if (collected.length >= MAX_RECORDS_PER_FIND) return
      const key = radarDedupeKey(input.source, input.externalId)
      if (seenRecords.has(key)) continue
      seenRecords.add(key)
      closenessByRecord.set(key, rung)
      collected.push(input)
      for (const person of input.people) {
        const name = normalisePersonName(person.name)
        if (name) seenPeople.add(name)
      }
    }
  }

  /** One query against both catalogues. Returns how many new records it added. */
  async function attempt(query: string, days: number, rung: number): Promise<number> {
    attempts += 1
    const fromDate = isoDaysAgo(days)

    // Both catalogues, settled independently. OpenAlex throttles anonymous
    // callers hard enough to fail a click (429, sometimes dressed as 503), and
    // losing the whole feature to that while Europe PMC answers normally is not
    // a trade worth making.
    const [works, records] = await Promise.allSettled([
      searchWorks({ search: query, fromDate, limit: WORKS_PER_FIND }),
      searchEuropePmc({ search: query, fromDate, limit: WORKS_PER_FIND }),
    ])
    if (works.status === 'rejected') lastFailure = asError(works.reason)
    if (records.status === 'rejected') lastFailure = asError(records.reason)
    if ((works.status === 'rejected') !== (records.status === 'rejected')) oneSourceDown = true
    if (works.status === 'fulfilled' || records.status === 'fulfilled') answered = true

    const before = collected.length
    if (works.status === 'fulfilled') collect(signalsFromWorks(works.value), rung)
    if (records.status === 'fulfilled') collect(signalsFromEuropePmc(records.value), rung)
    const gained = collected.length - before

    // The reported query is the one that actually supplied the material.
    if (gained > 0) {
      used = query
      usedFrom = fromDate
    }

    trace.push(
      `"${query}" since ${fromDate} → ` +
        `openalex ${works.status === 'fulfilled' ? works.value.length : 'FAILED'}, ` +
        `europepmc ${records.status === 'fulfilled' ? records.value.length : 'FAILED'}, ` +
        `+${gained} new (${seenPeople.size} people so far)`,
    )
    return gained
  }

  // Narrowest query first, giving up a term only once that query has genuinely
  // been exhausted. A query that returns nothing has said something about the
  // *window*, not about the question — so it is retried over three years before
  // any term is surrendered. Broadening is the expensive move: it is what turns
  // "CAR-T in Brazil" into "CAR-T", and it should be the last resort, not the
  // first.
  for (const [rung, query] of queries.entries()) {
    if (attempts >= MAX_ATTEMPTS) break
    const gained = await attempt(query, baseWindow, rung)
    if (gained === 0 && deepWindow > baseWindow && attempts < MAX_ATTEMPTS) {
      await attempt(query, deepWindow, rung)
    }
    if (enough()) break
  }

  // Only give up when *nothing* answered. One source down is a thinner result,
  // not a failed run.
  if (!answered) {
    throw new Error(`The scholarly sources could not be reached: ${failureMessage()}`)
  }

  const found = dedupeAcrossSources(collected)
  const { signals } = await storeSignals(db, found)
  const options = personOptions(signals, { limit: MAX_OPTIONS, closenessByRecord })

  const sourceNote = oneSourceDown
    ? ` One of the two catalogues did not answer (${failureMessage()}), so this is a thinner read than usual.`
    : ''

  console.info(
    `[podcast-planning] find-names q=${question.id} terms="${search}" ` +
      `attempts=${attempts} records=${found.length} people=${seenPeople.size} ` +
      `options=${options.length}\n  ${trace.join('\n  ')}`,
  )

  if (options.length === 0) {
    return {
      ...NOTHING,
      signals: signals.length,
      message:
        `Searched open scholarly sources for “${used}” back to ${usedFrom} and found ` +
        `${found.length} paper${found.length === 1 ? '' : 's'}, but no named authors to work from. ` +
        `This question may need a route other than the literature — a regulator, a patient ` +
        `organisation or a congress programme — so try adding a name by hand.${sourceNote}`,
    }
  }

  // `<unknown>`, as every other structured caller does: with a `structuredFormat`
  // set the client returns the parsed object, and the generic's `string` default
  // would let the compiler agree with code that treats it as text.
  const reply = await runAiMessage<unknown>({
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
  const grounded = groundNames(parsed, options, {
    limit: Math.max(config.maxNames, TARGET_NAMES),
  })

  // Top the shortlist up from the people who were retrieved but not chosen.
  // They are the same cited authors in the same ranked order; what they lack is
  // the editorial sentence, and their angle says exactly that.
  const { names, added } = fillToFloor(grounded.names, options, TARGET_NAMES)

  console.info(
    `[podcast-planning] find-names q=${question.id} parsed=${parsed === null ? 'FAILED' : 'ok'} ` +
      `picked=${grounded.names.length} floored=${added} ` +
      `dropped=${JSON.stringify(grounded.dropped)}`,
  )

  if (names.length === 0) {
    return {
      ...NOTHING,
      signals: signals.length,
      candidates: options.length,
      ungrounded: grounded.dropped.unknownRef,
      message:
        `Read ${signals.length} paper${signals.length === 1 ? '' : 's'} naming ${options.length} ` +
        `author${options.length === 1 ? '' : 's'}, but nothing could be put forward from them.${sourceNote}`,
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
    signalIds: [...new Set(names.map((n) => n.signalId))],
    names,
    model: reply.config.model,
    effort: reply.config.effort,
    rawResponse: parsed ?? { unparsed: unparsedReply(reply.output) },
    createdBy: opts.createdBy ?? null,
  })

  // The three things worth saying, in the order somebody would ask them: how
  // many names, what was read to get them, and what is not yet judged.
  const parseNote =
    parsed === null
      ? ' The assistant’s reply could not be read, so these are ranked by the evidence alone.'
      : ''
  const floorNote =
    added > 0 && parsed !== null
      ? ` ${added} of them ${added === 1 ? 'is' : 'are'} ranked by evidence and not yet assessed against the question.`
      : ''

  return {
    proposalId,
    signals: signals.length,
    candidates: options.length,
    suggested: names.length,
    unassessed: added,
    ungrounded: grounded.dropped.unknownRef,
    message:
      `${names.length} name${names.length === 1 ? '' : 's'} from ${signals.length} ` +
      `paper${signals.length === 1 ? '' : 's'}, searched as “${used}” back to ${usedFrom}.` +
      `${floorNote}${parseNote}${sourceNote}`,
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
  const reply = await runAiMessage<unknown>({
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
      rawResponse: parsed ?? { unparsed: unparsedReply(reply.output) },
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
