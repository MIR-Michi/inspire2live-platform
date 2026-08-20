/**
 * kernel/sources/openalex.ts — a thin, typed client for the OpenAlex works API.
 *
 * OpenAlex is a free, open catalogue of scholarly works. It is used here for one
 * property that no model can supply: it returns **authors with stable
 * identifiers and stated affiliations**, as data. ADR-0016 makes that the spine
 * of Radar — the model is only ever handed people this client already found.
 *
 * Deliberately domain-free. It knows nothing about podcasts, questions or
 * candidates, and it is the same client `network` will use for co-authorship
 * routes. That is why it is kernel and not a component capability.
 *
 * Etiquette and limits, both non-optional in a serverless function:
 *  - the polite pool needs a contact address in `mailto`, and gives faster,
 *    more reliable service in exchange (`OPENALEX_CONTACT_EMAIL`);
 *  - every call is capped and time-limited, so one slow upstream cannot hold a
 *    request open until the platform kills it.
 */

const OPENALEX_BASE = 'https://api.openalex.org'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_PER_PAGE = 200

export type OpenAlexAuthor = {
  /** OpenAlex author id, e.g. `A5013300776` (the URL prefix is stripped). */
  id: string
  name: string
  orcid: string | null
  /** 'first' | 'middle' | 'last' — first and last authorship carry the argument. */
  position: string
  organisation: string | null
  /** ISO-3166 alpha-2, upper case. */
  country: string | null
  isCorresponding: boolean
}

export type OpenAlexWork = {
  /** OpenAlex work id, e.g. `W2741809807`. */
  id: string
  title: string
  doi: string | null
  /** ISO date (`YYYY-MM-DD`) of publication, as the source reports it. */
  publicationDate: string | null
  /** Best public landing page: the DOI when there is one, else OpenAlex. */
  url: string
  venue: string | null
  citedByCount: number
  isOpenAccess: boolean
  type: string | null
  authors: OpenAlexAuthor[]
}

export type OpenAlexQuery = {
  /** Free text matched against title, abstract and full text. */
  search: string
  /** Inclusive lower bound on publication date (`YYYY-MM-DD`). */
  fromDate?: string
  /** How many works to return. Capped at 200 by the API and by this client. */
  limit?: number
  /**
   * Restrict to work types. Defaults to `article`, which excludes the
   * editorials, errata and paratext that otherwise dominate a recent-date
   * search and name people who did not write anything.
   */
  types?: string[]
}

export class OpenAlexError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'OpenAlexError'
  }
}

/** Strip the `https://openalex.org/` prefix OpenAlex puts on every identifier. */
function shortId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const slash = value.lastIndexOf('/')
  return slash === -1 ? value : value.slice(slash + 1)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * OpenAlex returns dates as `YYYY-MM-DD`, but a missing day is reported as a
 * year alone. Anything that is not a full date is discarded rather than
 * guessed: the date ends up on `why_now_at`, where the timeliness decay reads
 * it, and an invented 1 January would be a real error in the score.
 */
function isoDate(value: unknown): string | null {
  const raw = str(value)
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

type RawAuthorship = {
  author?: { id?: unknown; display_name?: unknown; orcid?: unknown }
  author_position?: unknown
  institutions?: Array<{ display_name?: unknown; country_code?: unknown }>
  countries?: unknown
  is_corresponding?: unknown
  raw_author_name?: unknown
}

function toAuthor(raw: RawAuthorship): OpenAlexAuthor | null {
  const id = shortId(raw.author?.id)
  const name = str(raw.author?.display_name) ?? str(raw.raw_author_name)
  if (!id || !name) return null

  const institution = (raw.institutions ?? []).find((i) => str(i.display_name))
  const country =
    str(institution?.country_code) ??
    (Array.isArray(raw.countries) ? str(raw.countries[0]) : null)

  return {
    id,
    name,
    orcid: shortId(raw.author?.orcid),
    position: str(raw.author_position) ?? 'middle',
    organisation: str(institution?.display_name),
    country: country ? country.toUpperCase() : null,
    isCorresponding: raw.is_corresponding === true,
  }
}

type RawWork = {
  id?: unknown
  title?: unknown
  display_name?: unknown
  doi?: unknown
  publication_date?: unknown
  primary_location?: { source?: { display_name?: unknown } | null } | null
  cited_by_count?: unknown
  open_access?: { is_oa?: unknown } | null
  type?: unknown
  is_retracted?: unknown
  authorships?: RawAuthorship[]
}

function toWork(raw: RawWork): OpenAlexWork | null {
  const id = shortId(raw.id)
  const title = str(raw.title) ?? str(raw.display_name)
  if (!id || !title) return null
  // A retracted paper is the opposite of a reason to platform its authors.
  if (raw.is_retracted === true) return null

  const doi = str(raw.doi)
  const authors = (raw.authorships ?? [])
    .map(toAuthor)
    .filter((a): a is OpenAlexAuthor => a !== null)

  return {
    id,
    title,
    doi,
    publicationDate: isoDate(raw.publication_date),
    url: doi ?? `https://openalex.org/${id}`,
    venue: str(raw.primary_location?.source?.display_name),
    citedByCount: typeof raw.cited_by_count === 'number' ? raw.cited_by_count : 0,
    isOpenAccess: raw.open_access?.is_oa === true,
    type: str(raw.type),
    authors,
  }
}

/**
 * Search OpenAlex for recent works.
 *
 * Throws `OpenAlexError` rather than returning an empty list on failure: a
 * caller that cannot tell "the source is down" from "there is nothing new"
 * will report the wrong thing to the person waiting.
 */
export async function searchWorks(query: OpenAlexQuery): Promise<OpenAlexWork[]> {
  const search = query.search?.trim()
  if (!search) return []

  const limit = Math.min(Math.max(query.limit ?? 25, 1), MAX_PER_PAGE)
  const filters = [`title_and_abstract.search:${search.replace(/[,|]/g, ' ')}`]
  if (query.fromDate) filters.push(`from_publication_date:${query.fromDate}`)
  const types = query.types ?? ['article']
  if (types.length > 0) filters.push(`type:${types.join('|')}`)

  const url = new URL(`${OPENALEX_BASE}/works`)
  url.searchParams.set('filter', filters.join(','))
  url.searchParams.set('per-page', String(limit))
  url.searchParams.set('sort', 'publication_date:desc')
  // The polite pool. Without it OpenAlex may throttle or refuse; with it the
  // service is documented as faster and more consistent.
  const contact = process.env.OPENALEX_CONTACT_EMAIL
  if (contact) url.searchParams.set('mailto', contact)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new OpenAlexError(
        `OpenAlex returned ${response.status} ${response.statusText}.`,
        response.status,
      )
    }
    const body = (await response.json()) as { results?: RawWork[] }
    return (body.results ?? []).map(toWork).filter((w): w is OpenAlexWork => w !== null)
  } catch (error) {
    if (error instanceof OpenAlexError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAlexError(`OpenAlex did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`)
    }
    throw new OpenAlexError(error instanceof Error ? error.message : 'OpenAlex request failed.')
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * The authors worth surfacing from a work.
 *
 * First and last authorship is the convention in biomedical publishing for the
 * person who did the work and the person who led it; a middle author on a
 * forty-name consortium paper is not a signal that they can speak to it. When
 * a paper has three authors or fewer everybody is kept, because the convention
 * does not apply to a small team.
 */
export function principalAuthors(work: OpenAlexWork): OpenAlexAuthor[] {
  if (work.authors.length <= 3) return work.authors
  return work.authors.filter(
    (a) => a.position === 'first' || a.position === 'last' || a.isCorresponding,
  )
}
