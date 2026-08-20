/**
 * kernel/sources/europepmc.ts — a thin, typed client for the Europe PMC search API.
 *
 * The second structured source behind Radar (ADR-0016). It is not a duplicate of
 * OpenAlex: Europe PMC indexes clinical and regulatory literature that OpenAlex
 * covers late or not at all — trial reports, guidelines, and preprints — and it
 * carries an explicit publication type, which is what lets a scan tell a
 * randomised trial from a commentary about one.
 *
 * The overlap with OpenAlex is a feature rather than waste. Two catalogues
 * indexing the same paper is exactly the independence the two-source floor is
 * trying to measure, and the DOI is what lets the caller notice it is one paper
 * and not two.
 *
 * Domain-free, like its sibling: no podcast vocabulary, no scoring, no opinion
 * about what is interesting.
 */

const EUROPEPMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_PAGE_SIZE = 100

export type EuropePmcAuthor = {
  name: string
  /** Present only where the record carries it; most do not. */
  orcid: string | null
  organisation: string | null
  /** Position in the author list, 1-based, as printed. */
  position: number
}

export type EuropePmcRecord = {
  /** Stable within its source, e.g. `MED/38912345`. Use with `source` for a key. */
  id: string
  /** `MED`, `PPR` (preprint), `PMC`, … */
  source: string
  title: string
  doi: string | null
  /** ISO date (`YYYY-MM-DD`) where the record states a full one. */
  publicationDate: string | null
  url: string
  journal: string | null
  /** e.g. `Randomized Controlled Trial`, `review`, `preprint`. Lower-cased. */
  publicationTypes: string[]
  isPreprint: boolean
  citedByCount: number
  authors: EuropePmcAuthor[]
}

export type EuropePmcQuery = {
  search: string
  /** Inclusive lower bound on the first publication date (`YYYY-MM-DD`). */
  fromDate?: string
  limit?: number
}

export class EuropePmcError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'EuropePmcError'
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function isoDate(value: unknown): string | null {
  const raw = str(value)
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function intOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

type RawAuthor = {
  fullName?: unknown
  firstName?: unknown
  lastName?: unknown
  authorId?: { type?: unknown; value?: unknown } | null
  authorAffiliationDetailsList?: {
    authorAffiliation?: Array<{ affiliation?: unknown }>
  } | null
}

function toAuthor(raw: RawAuthor, index: number): EuropePmcAuthor | null {
  const name =
    str(raw.fullName) ??
    [str(raw.firstName), str(raw.lastName)].filter(Boolean).join(' ').trim() ??
    null
  if (!name) return null

  const orcid =
    str(raw.authorId?.type)?.toUpperCase() === 'ORCID' ? str(raw.authorId?.value) : null
  const affiliation = raw.authorAffiliationDetailsList?.authorAffiliation?.find((a) =>
    str(a.affiliation),
  )

  return {
    name,
    orcid,
    organisation: str(affiliation?.affiliation),
    position: index + 1,
  }
}

type RawResult = {
  id?: unknown
  source?: unknown
  title?: unknown
  doi?: unknown
  firstPublicationDate?: unknown
  journalInfo?: { journal?: { title?: unknown } | null } | null
  pubTypeList?: { pubType?: unknown } | null
  citedByCount?: unknown
  authorList?: { author?: RawAuthor[] } | null
}

function toRecord(raw: RawResult): EuropePmcRecord | null {
  const id = str(raw.id)
  const source = str(raw.source)
  const title = str(raw.title)
  if (!id || !source || !title) return null

  // The API returns pubType as a string or a list depending on the record.
  const rawTypes = raw.pubTypeList?.pubType
  const publicationTypes = (Array.isArray(rawTypes) ? rawTypes : [rawTypes])
    .map((t) => str(t)?.toLowerCase())
    .filter((t): t is string => Boolean(t))

  const doi = str(raw.doi)
  const authors = (raw.authorList?.author ?? [])
    .map(toAuthor)
    .filter((a): a is EuropePmcAuthor => a !== null)

  return {
    id,
    source,
    title,
    doi,
    publicationDate: isoDate(raw.firstPublicationDate),
    url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${source}/${id}`,
    journal: str(raw.journalInfo?.journal?.title),
    publicationTypes,
    isPreprint: source.toUpperCase() === 'PPR' || publicationTypes.includes('preprint'),
    citedByCount: intOr(raw.citedByCount, 0),
    authors,
  }
}

/**
 * Search Europe PMC for recent records.
 *
 * Throws rather than returning an empty list on failure, for the same reason
 * the OpenAlex client does: "the source is down" and "there is nothing new" are
 * different answers and the caller has to be able to say which one it got.
 */
export async function searchEuropePmc(query: EuropePmcQuery): Promise<EuropePmcRecord[]> {
  const search = query.search?.trim()
  if (!search) return []

  const limit = Math.min(Math.max(query.limit ?? 25, 1), MAX_PAGE_SIZE)

  // Each term is scoped to title and abstract. An unscoped Europe PMC query
  // searches full text, and full text matches anything that merely cites the
  // subject in passing — the first live run returned an elbow-arthroplasty
  // paper for a cancer query. Scoping is what makes this comparable to the
  // OpenAlex client's `title_and_abstract.search`.
  const terms = search
    .replace(/[():"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length === 0) return []

  const clauses = [terms.map((term) => `TITLE_ABS:${term}`).join(' AND ')]
  if (query.fromDate) clauses.push(`(FIRST_PDATE:[${query.fromDate} TO 3000-01-01])`)

  const url = new URL(`${EUROPEPMC_BASE}/search`)
  url.searchParams.set('query', clauses.join(' AND '))
  url.searchParams.set('format', 'json')
  url.searchParams.set('pageSize', String(limit))
  url.searchParams.set('sort', 'P_PDATE_D desc')
  // `core` is what carries the author list and affiliations; the default
  // `lite` result set has neither, and authors are the whole point.
  url.searchParams.set('resultType', 'core')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new EuropePmcError(
        `Europe PMC returned ${response.status} ${response.statusText}.`,
        response.status,
      )
    }
    const body = (await response.json()) as { resultList?: { result?: RawResult[] } }
    return (body.resultList?.result ?? [])
      .map(toRecord)
      .filter((r): r is EuropePmcRecord => r !== null)
  } catch (error) {
    if (error instanceof EuropePmcError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new EuropePmcError(`Europe PMC did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`)
    }
    throw new EuropePmcError(
      error instanceof Error ? error.message : 'Europe PMC request failed.',
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * The authors worth surfacing, by the same convention as the OpenAlex client:
 * first and last carry the argument, and a small team is kept whole. Europe PMC
 * does not label authorship position, so it is taken from the printed order.
 */
export function principalEuropePmcAuthors(record: EuropePmcRecord): EuropePmcAuthor[] {
  const authors = record.authors
  if (authors.length <= 3) return authors
  return [authors[0], authors[authors.length - 1]]
}
