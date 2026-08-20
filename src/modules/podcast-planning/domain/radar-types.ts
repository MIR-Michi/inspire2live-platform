/**
 * podcast-planning/domain/radar-types.ts — Radar's vocabulary, and the pure
 * functions that turn source records into something a model may be shown.
 *
 * Everything here is pure and synchronous. That is not tidiness: the two rules
 * ADR-0016 rests on — a person must come from a record, and "independent
 * sources" must be a count rather than a claim — are only worth anything if
 * they can be exercised in a unit test without a database or a provider.
 */

import type { EuropePmcRecord, OpenAlexWork } from '@/kernel/sources'
import { principalAuthors, principalEuropePmcAuthors } from '@/kernel/sources'

/** Which open source produced a signal. Mirrors the check on the table. */
export type SignalSource = 'openalex' | 'europepmc' | 'congress_programme' | 'regulator' | 'web'

/** A person a source itself named, with the affiliation that source stated. */
export type SignalPerson = {
  name: string
  role: string | null
  organisation: string | null
  country: string | null
  /** The source's own identifier for them (an OpenAlex author id), when it has one. */
  externalId: string | null
  url: string | null
}

/** One record from an open source, before anything has interpreted it. */
export type RadarSignal = {
  id: string
  source: SignalSource
  externalId: string
  title: string
  url: string | null
  publishedAt: string | null
  people: SignalPerson[]
  discoveredAt: string
}

/** A signal that has been normalised but not yet stored. */
export type RadarSignalInput = Omit<RadarSignal, 'id' | 'discoveredAt'> & {
  payload?: Record<string, unknown>
}

export type RadarMode = 'names' | 'topic'

export type ProposalStatus = 'pending' | 'opened' | 'dismissed' | 'later' | 'superseded'

/**
 * The three reasons a proposal can be waved away. Free text was considered and
 * rejected: these taps are the only training signal Radar ever gets, so they
 * have to cost nothing to give (concept §3).
 */
export type DismissReason = 'off_agenda' | 'already_covered' | 'not_a_question'

export const DISMISS_REASON_META: Record<DismissReason, { label: string; hint: string }> = {
  off_agenda: {
    label: 'Not our agenda',
    hint: 'Real, but not what Inspire2Live is for.',
  },
  already_covered: {
    label: 'Already covered',
    hint: 'We have asked this, or something close enough.',
  },
  not_a_question: {
    label: 'Not a question',
    hint: 'A subject area, not something somebody could disagree with.',
  },
}

/** A person Radar suggests, resolved back to the record that named them. */
export type SuggestedName = {
  name: string
  role: string | null
  organisation: string | null
  country: string | null
  /** One sentence on what only they could say. The model's judgement, reviewed. */
  angle: string
  /** The signal that named them. Never null: an unresolvable one is dropped. */
  signalId: string
  url: string | null
  /** How many of the proposal's signals name this person. */
  sourceCount: number
}

export type RadarProposal = {
  id: string
  questionId: string | null
  mode: RadarMode
  proposedQuestion: string
  whyNow: string | null
  whyNowAt: string | null
  signalIds: string[]
  names: SuggestedName[]
  status: ProposalStatus
  dismissedReason: DismissReason | null
  decidedAt: string | null
  openedQuestionId: string | null
  openedCandidates: number
  createdAt: string
}

export type RadarRunState = 'idle' | 'running' | 'success' | 'error'

export type RadarRunStatus = {
  status: RadarRunState
  message: string | null
  startedAt: string | null
  finishedAt: string | null
  inserted: number | null
}

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * The one place a signal's identity is decided.
 *
 * Computed the same way on every insert path so a paper found by the
 * fortnightly scan and the same paper found by "Find names" converge on one
 * row — which is what stops a re-run inflating the independent-source count.
 */
export function radarDedupeKey(source: SignalSource, externalId: string): string {
  return `${source}:${externalId.trim().toLowerCase()}`
}

/** Names vary by initials and punctuation; comparison must not. */
export function normalisePersonName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Independence ────────────────────────────────────────────────────────────

/**
 * How many *independent* sources a set of signals really represents.
 *
 * This number is worth six points of timeliness and saturates at three, so
 * counting rows would be an invitation to inflate it: five papers from one lab
 * are one source that published five times. Two signals are treated as the same
 * source when they share an author or a venue, and the count is the number of
 * resulting clusters.
 *
 * Union-find over an explicit rule, so a surprising number can always be
 * explained by pointing at the overlap that caused it.
 */
export function countIndependentSources(
  signals: Array<Pick<RadarSignal, 'people' | 'url'> & { venue?: string | null }>,
): number {
  if (signals.length === 0) return 0

  const parent = signals.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const byToken = new Map<string, number>()
  signals.forEach((signal, index) => {
    const tokens = [
      ...signal.people.map((p) => `person:${normalisePersonName(p.name)}`),
      ...(signal.venue ? [`venue:${signal.venue.toLowerCase().trim()}`] : []),
    ]
    for (const token of tokens) {
      const seen = byToken.get(token)
      if (seen === undefined) byToken.set(token, index)
      else union(seen, index)
    }
  })

  return new Set(signals.map((_, i) => find(i))).size
}

// ─── Normalising a source ────────────────────────────────────────────────────

/**
 * Turn OpenAlex works into signals.
 *
 * Only principal authors are carried through. A middle author on a forty-name
 * consortium paper has not been shown to be able to speak to it, and putting
 * them on the list would make the shortlist unreadable — which is the failure
 * mode the whole review interaction is designed to avoid.
 */
/**
 * Records that are not papers.
 *
 * Seen on the first live run: OpenAlex indexes supplementary artefacts
 * alongside articles, and they arrive with their markup intact — an
 * "<p>Interview guide for patients and relatives.</p>" is a file attached to a
 * study, not a reason to invite its authors onto a podcast.
 */
function isArtefact(title: string): boolean {
  // The length floor stays low deliberately: "CAR-T in AML" is a real title,
  // and dropping a real paper is worse than passing a stub the model ignores.
  return /<\/?[a-z][^>]*>/i.test(title) || title.trim().length < 10
}

export function signalsFromWorks(works: OpenAlexWork[]): RadarSignalInput[] {
  return works.filter((work) => !isArtefact(work.title) && work.authors.length > 0).map((work) => ({
    source: 'openalex' as const,
    externalId: work.id,
    title: work.title,
    url: work.url,
    publishedAt: work.publicationDate,
    people: principalAuthors(work).map((author) => ({
      name: author.name,
      role: author.position === 'first' ? 'First author' : author.position === 'last' ? 'Senior author' : 'Author',
      organisation: author.organisation,
      country: author.country,
      externalId: author.id,
      url: author.orcid ? `https://orcid.org/${author.orcid}` : null,
    })),
    payload: {
      venue: work.venue,
      doi: work.doi,
      citedByCount: work.citedByCount,
      isOpenAccess: work.isOpenAccess,
      type: work.type,
    },
  }))
}

/**
 * Turn Europe PMC records into signals.
 *
 * Two deliberate differences from the OpenAlex mapping. Preprints are kept —
 * an unreviewed result that three groups are arguing about is often exactly the
 * "why now" a question needs, and the record says plainly that it is a preprint
 * so a reviewer can weigh it. And the DOI is carried in the payload, because it
 * is the only thing that will later reveal that this record and an OpenAlex one
 * are the same paper counted twice.
 */
export function signalsFromEuropePmc(records: EuropePmcRecord[]): RadarSignalInput[] {
  return records
    .filter((record) => !isArtefact(record.title) && record.authors.length > 0)
    .map((record) => {
      const principals = principalEuropePmcAuthors(record)
      const last = record.authors[record.authors.length - 1]
      return {
        source: 'europepmc' as const,
        externalId: `${record.source}/${record.id}`,
        title: record.title,
        url: record.url,
        publishedAt: record.publicationDate,
        people: principals.map((author) => ({
          name: author.name,
          role:
            author.position === 1
              ? 'First author'
              : author.name === last?.name
                ? 'Senior author'
                : 'Author',
          organisation: author.organisation,
          country: null,
          externalId: author.orcid,
          url: author.orcid ? `https://orcid.org/${author.orcid}` : null,
        })),
        payload: {
          venue: record.journal,
          doi: record.doi,
          citedByCount: record.citedByCount,
          isPreprint: record.isPreprint,
          publicationTypes: record.publicationTypes,
        },
      }
    })
}

/**
 * Collapse records that two catalogues both indexed.
 *
 * Two sources holding the same DOI is one paper, not the two independent
 * sources the minimum-source floor is asking for, and counting it twice would
 * let a single result clear a bar built to require corroboration. OpenAlex wins
 * ties because it carries author identifiers and stated countries, which
 * Europe PMC mostly does not.
 */
export function dedupeAcrossSources(inputs: RadarSignalInput[]): RadarSignalInput[] {
  const byDoi = new Map<string, RadarSignalInput>()
  const out: RadarSignalInput[] = []

  for (const input of inputs) {
    const doi = typeof input.payload?.doi === 'string' ? input.payload.doi.toLowerCase() : null
    const key = doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '') ?? null
    if (!key) {
      out.push(input)
      continue
    }
    const existing = byDoi.get(key)
    if (!existing) {
      byDoi.set(key, input)
      continue
    }
    if (existing.source !== 'openalex' && input.source === 'openalex') byDoi.set(key, input)
  }

  return [...out, ...byDoi.values()]
}

// ─── Searching ───────────────────────────────────────────────────────────────

/**
 * Words that carry no retrieval value but plenty of question-shaped noise.
 * A question is written to be arguable — "should", "why", "still" — and every
 * one of those words matches everything.
 */
const STOPWORDS = new Set([
  'a', 'about', 'after', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'being',
  'but', 'by', 'can', 'do', 'does', 'for', 'from', 'get', 'has', 'have', 'how', 'if', 'in',
  'into', 'is', 'it', 'its', 'just', 'more', 'most', 'much', 'must', 'no', 'not', 'of', 'on',
  'only', 'or', 'our', 'out', 'over', 'should', 'so', 'some', 'still', 'such', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'up', 'was', 'we',
  'were', 'what', 'when', 'where', 'whether', 'which', 'who', 'why', 'will', 'with', 'would',
  'you', 'your',
])

/**
 * The most terms a query may carry.
 *
 * Measured against the live index rather than guessed: OpenAlex ANDs the words
 * in a `title_and_abstract.search`, so a five-word query out of a real question
 * returned a single paper where three words returned 138. Four is the point
 * where a query is still specific and still retrieves something.
 */
export const MAX_SEARCH_TERMS = 4

/**
 * The search string for a question.
 *
 * Tags win when they exist, because somebody chose them deliberately; the
 * question's own content words are the fallback. Terms are ANDed by the index,
 * so ordering matters — the caller widens a query by dropping from the end.
 */
export function searchTermsForQuestion(question: string, tags: string[] = []): string {
  const fromTags = tags.map((t) => t.trim()).filter(Boolean)
  // Tags replace the content words rather than joining them. Adding "different"
  // to "surrogate endpoints reimbursement" does not widen the search, it
  // narrows it — every extra word is another AND.
  if (fromTags.length > 0) return [...new Set(fromTags)].slice(0, MAX_SEARCH_TERMS).join(' ')

  const fromText = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))

  return [...new Set(fromText)].slice(0, MAX_SEARCH_TERMS).join(' ')
}

/**
 * Progressively broader versions of a query, narrowest first, each keeping the
 * domain anchor.
 *
 * Two failures observed against the live index, and this is the fix for both.
 *
 * *Too narrow:* every term is ANDed, so a real four-word question matched a
 * single paper where three of its words matched 138. Dropping from the end
 * until something comes back recovers those.
 *
 * *Too loose:* the content words left over from a question — "enough",
 * "actually", "change" — are not stopwords but carry no subject, and a search
 * on them returned a twin-prime proof and a kidney-stone study. The anchor is
 * never dropped, so every query stays inside the organisation's field.
 */
export function wideningSearches(search: string, anchor?: string | null): string[] {
  const anchorTerms = (anchor ?? '').split(/\s+/).filter(Boolean)
  const terms = search
    .split(/\s+/)
    .filter(Boolean)
    .filter((term) => !anchorTerms.includes(term))

  const attempts: string[] = []
  // Stop at one question term beside the anchor: the anchor alone is a subject
  // area, and a subject area retrieves everything.
  for (let size = terms.length; size >= 1; size -= 1) {
    attempts.push([...anchorTerms, ...terms.slice(0, size)].join(' '))
  }
  if (attempts.length === 0 && anchorTerms.length > 0) attempts.push(anchorTerms.join(' '))
  return attempts
}

// ─── The bounded list the model is allowed to choose from ────────────────────

/**
 * One person the model may pick, with a short reference it answers with.
 *
 * This is the structural half of ADR-0016 §2. The model never writes a name, an
 * organisation or a country — it returns `ref: 'p7'`, and the name attached to
 * p7 came out of the API. Fabricating a person is therefore not something the
 * validator has to catch; it is not expressible.
 */
export type PersonOption = {
  ref: string
  name: string
  role: string | null
  organisation: string | null
  country: string | null
  signalId: string
  signalTitle: string
  publishedAt: string | null
  url: string | null
  sourceCount: number
}

/**
 * Collapse the people named across a set of signals into one option each,
 * strongest evidence first.
 *
 * Ordering matters more than it looks: when the list is truncated it is
 * truncated from the bottom, so somebody named by three papers must never be
 * dropped in favour of somebody named by one.
 */
export function personOptions(
  signals: RadarSignal[],
  opts: { limit?: number } = {},
): PersonOption[] {
  type Draft = Omit<PersonOption, 'ref'> & { latest: string }
  const byName = new Map<string, Draft>()

  for (const signal of signals) {
    for (const person of signal.people) {
      const key = normalisePersonName(person.name)
      if (!key) continue
      const existing = byName.get(key)
      if (existing) {
        existing.sourceCount += 1
        // Keep the most recent signal as the citation, and take an affiliation
        // from whichever record actually stated one.
        if ((signal.publishedAt ?? '') > existing.latest) {
          existing.latest = signal.publishedAt ?? existing.latest
          existing.signalId = signal.id
          existing.signalTitle = signal.title
          existing.publishedAt = signal.publishedAt
        }
        existing.organisation ??= person.organisation
        existing.country ??= person.country
        existing.url ??= person.url
        continue
      }
      byName.set(key, {
        name: person.name,
        role: person.role,
        organisation: person.organisation,
        country: person.country,
        signalId: signal.id,
        signalTitle: signal.title,
        publishedAt: signal.publishedAt,
        url: person.url ?? signal.url,
        sourceCount: 1,
        latest: signal.publishedAt ?? '',
      })
    }
  }

  const ranked = [...byName.values()].sort(
    (a, b) => b.sourceCount - a.sourceCount || (b.latest > a.latest ? 1 : b.latest < a.latest ? -1 : 0),
  )
  const limit = opts.limit ?? 60
  return ranked.slice(0, limit).map(({ latest: _latest, ...option }, index) => ({
    ref: `p${index + 1}`,
    ...option,
  }))
}
