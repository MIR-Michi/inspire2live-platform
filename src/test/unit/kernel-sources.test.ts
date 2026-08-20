/**
 * kernel/sources — the two open catalogues Radar is built on.
 *
 * ADR-0016 makes these clients load-bearing: every fact a reviewer sees about a
 * suggested person comes from a record one of them parsed, so a silent parsing
 * failure does not degrade Radar, it fabricates. The tests are therefore about
 * *normalisation and refusal* rather than about HTTP — payloads are the shapes
 * the live APIs actually return (trimmed), and `fetch` is stubbed so no test
 * touches the network.
 *
 * The recurring theme is that a missing field must produce a missing value and
 * never a guessed one: a year where a date belongs, an empty author, a record
 * with no title. Each of those becomes a citation somebody may act on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EuropePmcError,
  OpenAlexError,
  principalAuthors,
  principalEuropePmcAuthors,
  searchEuropePmc,
  searchWorks,
} from '@/kernel/sources'
import type { EuropePmcRecord, OpenAlexWork } from '@/kernel/sources'

// ─── Stubbing the network ─────────────────────────────────────────────────────

let calls: string[] = []

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL | string) => {
      calls.push(String(url))
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        statusText: init.status === 503 ? 'Service Unavailable' : 'OK',
        json: async () => body,
      } as unknown as Response
    }),
  )
}

function failWith(error: Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw error
    }),
  )
}

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ─── OpenAlex ─────────────────────────────────────────────────────────────────

/** Trimmed from a real `/works` response. */
const OPENALEX_WORK = {
  id: 'https://openalex.org/W4399123456',
  title: 'Divergent evidence thresholds for molecular diagnostics across four payers',
  doi: 'https://doi.org/10.1000/example',
  publication_date: '2026-07-14',
  primary_location: { source: { display_name: 'Value in Health' } },
  cited_by_count: 7,
  open_access: { is_oa: true },
  type: 'article',
  authorships: [
    {
      author: {
        id: 'https://openalex.org/A5013300776',
        display_name: 'Clara Vasseur',
        orcid: 'https://orcid.org/0000-0002-1825-0097',
      },
      author_position: 'first',
      institutions: [{ display_name: 'Institut Curie', country_code: 'fr' }],
      is_corresponding: true,
    },
    {
      author: { id: 'https://openalex.org/A5100000002', display_name: 'Middle Person' },
      author_position: 'middle',
      institutions: [],
      countries: ['de'],
    },
    {
      author: { id: 'https://openalex.org/A5100000003', display_name: 'Nora Roessler' },
      author_position: 'last',
      institutions: [{ display_name: 'Charité', country_code: 'DE' }],
    },
  ],
}

describe('searchWorks — what comes back is what the record said', () => {
  it('normalises a work and its authors', async () => {
    respondWith({ results: [OPENALEX_WORK] })

    const [work] = await searchWorks({ search: 'reimbursement thresholds' })

    expect(work.id).toBe('W4399123456')
    expect(work.publicationDate).toBe('2026-07-14')
    expect(work.venue).toBe('Value in Health')
    expect(work.citedByCount).toBe(7)
    expect(work.isOpenAccess).toBe(true)
    // The DOI is the citation a reviewer should follow, so it wins the URL.
    expect(work.url).toBe('https://doi.org/10.1000/example')

    const first = work.authors[0]
    expect(first.id).toBe('A5013300776')
    expect(first.orcid).toBe('0000-0002-1825-0097')
    expect(first.organisation).toBe('Institut Curie')
    expect(first.country).toBe('FR')
    expect(first.isCorresponding).toBe(true)
  })

  it('falls back to the OpenAlex page only when there is no DOI', async () => {
    respondWith({ results: [{ ...OPENALEX_WORK, doi: null }] })
    const [work] = await searchWorks({ search: 'x' })
    expect(work.url).toBe('https://openalex.org/W4399123456')
  })

  it('takes the country from the authorship when the institution has none', async () => {
    respondWith({ results: [OPENALEX_WORK] })
    const [work] = await searchWorks({ search: 'x' })
    expect(work.authors[1].country).toBe('DE')
    expect(work.authors[1].organisation).toBeNull()
  })

  it('discards a partial date rather than inventing a day', async () => {
    respondWith({ results: [{ ...OPENALEX_WORK, publication_date: '2026' }] })
    const [work] = await searchWorks({ search: 'x' })
    // This date drives the timeliness decay; a guessed 1 January is a wrong score.
    expect(work.publicationDate).toBeNull()
  })

  it('drops a retracted paper entirely', async () => {
    respondWith({ results: [{ ...OPENALEX_WORK, is_retracted: true }] })
    expect(await searchWorks({ search: 'x' })).toEqual([])
  })

  it('drops records with no id or no title, and authors with no name', async () => {
    respondWith({
      results: [
        { ...OPENALEX_WORK, title: null, display_name: null },
        { ...OPENALEX_WORK, id: null },
        {
          ...OPENALEX_WORK,
          authorships: [{ author: { id: 'https://openalex.org/A1' } }, ...OPENALEX_WORK.authorships],
        },
      ],
    })
    const works = await searchWorks({ search: 'x' })
    expect(works).toHaveLength(1)
    expect(works[0].authors).toHaveLength(3)
  })

  it('asks only for articles, sorted newest first, within the date window', async () => {
    respondWith({ results: [] })
    await searchWorks({ search: 'surrogate endpoints', fromDate: '2026-01-01', limit: 40 })

    const url = new URL(calls[0])
    const filter = url.searchParams.get('filter') ?? ''
    expect(filter).toContain('title_and_abstract.search:surrogate endpoints')
    expect(filter).toContain('from_publication_date:2026-01-01')
    // Editorials and errata name people who did not write anything.
    expect(filter).toContain('type:article')
    expect(url.searchParams.get('sort')).toBe('publication_date:desc')
    expect(url.searchParams.get('per-page')).toBe('40')
  })

  it('joins the polite pool when a contact address is configured', async () => {
    vi.stubEnv('OPENALEX_CONTACT_EMAIL', 'ops@example.org')
    respondWith({ results: [] })
    await searchWorks({ search: 'x' })
    expect(new URL(calls[0]).searchParams.get('mailto')).toBe('ops@example.org')
  })

  it('never sends an empty search, and caps the page size', async () => {
    respondWith({ results: [] })
    expect(await searchWorks({ search: '   ' })).toEqual([])
    expect(calls).toHaveLength(0)

    await searchWorks({ search: 'x', limit: 5000 })
    expect(new URL(calls[0]).searchParams.get('per-page')).toBe('200')
  })

  it('throws rather than returning nothing when the source is down', async () => {
    respondWith({}, { ok: false, status: 503 })
    // "Down" and "nothing new" must not look the same to the caller.
    await expect(searchWorks({ search: 'x' })).rejects.toBeInstanceOf(OpenAlexError)
    await expect(searchWorks({ search: 'x' })).rejects.toMatchObject({ status: 503 })
  })

  it('reports a timeout as a timeout', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    failWith(abort)
    await expect(searchWorks({ search: 'x' })).rejects.toThrow(/did not respond within/i)
  })
})

describe('principalAuthors — who can speak for the work', () => {
  const work = (positions: string[]): OpenAlexWork =>
    ({
      authors: positions.map((position, index) => ({
        id: `A${index}`,
        name: `Person ${index}`,
        orcid: null,
        position,
        organisation: null,
        country: null,
        isCorresponding: false,
      })),
    }) as OpenAlexWork

  it('keeps a small team whole', () => {
    expect(principalAuthors(work(['first', 'middle', 'last']))).toHaveLength(3)
  })

  it('keeps only first and last on a large team', () => {
    const authors = principalAuthors(work(['first', 'middle', 'middle', 'middle', 'last']))
    expect(authors.map((a) => a.position)).toEqual(['first', 'last'])
  })

  it('keeps a corresponding middle author', () => {
    const big = work(['first', 'middle', 'middle', 'last'])
    big.authors[1].isCorresponding = true
    expect(principalAuthors(big)).toHaveLength(3)
  })
})

// ─── Europe PMC ───────────────────────────────────────────────────────────────

/** Trimmed from a real `resultType=core` response. */
const EUROPEPMC_RESULT = {
  id: '38912345',
  source: 'MED',
  title: 'Access to molecular testing across four European health systems',
  doi: '10.1000/europepmc-example',
  firstPublicationDate: '2026-06-30',
  journalInfo: { journal: { title: 'The Lancet Oncology' } },
  pubTypeList: { pubType: ['Journal Article', 'Randomized Controlled Trial'] },
  citedByCount: '12',
  authorList: {
    author: [
      {
        fullName: 'Roessler N',
        authorId: { type: 'ORCID', value: '0000-0003-1111-2222' },
        authorAffiliationDetailsList: {
          authorAffiliation: [{ affiliation: 'Charité — Universitätsmedizin Berlin' }],
        },
      },
      { firstName: 'Pieter', lastName: 'de Vries' },
    ],
  },
}

describe('searchEuropePmc — the second catalogue, parsed the same way', () => {
  it('normalises a record, its types and its authors', async () => {
    respondWith({ resultList: { result: [EUROPEPMC_RESULT] } })

    const [record] = await searchEuropePmc({ search: 'molecular testing access' })

    expect(record.id).toBe('38912345')
    expect(record.source).toBe('MED')
    expect(record.publicationDate).toBe('2026-06-30')
    expect(record.journal).toBe('The Lancet Oncology')
    expect(record.publicationTypes).toEqual(['journal article', 'randomized controlled trial'])
    expect(record.isPreprint).toBe(false)
    // The API reports this as a string; a string would break arithmetic later.
    expect(record.citedByCount).toBe(12)
    expect(record.url).toBe('https://doi.org/10.1000/europepmc-example')

    expect(record.authors[0]).toMatchObject({
      name: 'Roessler N',
      orcid: '0000-0003-1111-2222',
      organisation: 'Charité — Universitätsmedizin Berlin',
      position: 1,
    })
    expect(record.authors[1]).toMatchObject({ name: 'Pieter de Vries', position: 2, orcid: null })
  })

  it('accepts a single pubType as well as a list', async () => {
    respondWith({
      resultList: { result: [{ ...EUROPEPMC_RESULT, pubTypeList: { pubType: 'Review' } }] },
    })
    const [record] = await searchEuropePmc({ search: 'x' })
    expect(record.publicationTypes).toEqual(['review'])
  })

  it('recognises a preprint from the source or the type', async () => {
    respondWith({ resultList: { result: [{ ...EUROPEPMC_RESULT, source: 'PPR' }] } })
    expect((await searchEuropePmc({ search: 'x' }))[0].isPreprint).toBe(true)

    respondWith({
      resultList: { result: [{ ...EUROPEPMC_RESULT, pubTypeList: { pubType: ['Preprint'] } }] },
    })
    expect((await searchEuropePmc({ search: 'x' }))[0].isPreprint).toBe(true)
  })

  it('links to Europe PMC when the record has no DOI', async () => {
    respondWith({ resultList: { result: [{ ...EUROPEPMC_RESULT, doi: null }] } })
    const [record] = await searchEuropePmc({ search: 'x' })
    expect(record.url).toBe('https://europepmc.org/article/MED/38912345')
  })

  it('scopes every term to title and abstract', async () => {
    respondWith({ resultList: { result: [] } })
    await searchEuropePmc({ search: 'surrogate (endpoint): "reimbursement"', fromDate: '2026-02-01' })

    const query = new URL(calls[0]).searchParams.get('query') ?? ''
    // Unscoped, Europe PMC searches full text and returns papers that merely
    // cite the subject in passing — an elbow-arthroplasty paper for a cancer
    // query, in the first live run.
    expect(query).toContain('TITLE_ABS:surrogate AND TITLE_ABS:endpoint AND TITLE_ABS:reimbursement')
    expect(query).toContain('FIRST_PDATE:[2026-02-01 TO 3000-01-01]')
    expect(new URL(calls[0]).searchParams.get('resultType')).toBe('core')
  })

  it('returns nothing, and calls nothing, for a search with no usable terms', async () => {
    respondWith({ resultList: { result: [] } })
    expect(await searchEuropePmc({ search: '  ' })).toEqual([])
    expect(await searchEuropePmc({ search: '():"' })).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('drops records missing an id, a source or a title', async () => {
    respondWith({
      resultList: {
        result: [
          { ...EUROPEPMC_RESULT, title: null },
          { ...EUROPEPMC_RESULT, source: null },
          EUROPEPMC_RESULT,
        ],
      },
    })
    expect(await searchEuropePmc({ search: 'x' })).toHaveLength(1)
  })

  it('throws on an upstream failure and on a timeout', async () => {
    respondWith({}, { ok: false, status: 503 })
    await expect(searchEuropePmc({ search: 'x' })).rejects.toBeInstanceOf(EuropePmcError)

    const abort = new Error('aborted')
    abort.name = 'AbortError'
    failWith(abort)
    await expect(searchEuropePmc({ search: 'x' })).rejects.toThrow(/did not respond within/i)
  })
})

describe('principalEuropePmcAuthors — position taken from the printed order', () => {
  const record = (count: number): EuropePmcRecord =>
    ({
      authors: Array.from({ length: count }, (_, index) => ({
        name: `Person ${index}`,
        orcid: null,
        organisation: null,
        position: index + 1,
      })),
    }) as EuropePmcRecord

  it('keeps a small team whole', () => {
    expect(principalEuropePmcAuthors(record(3))).toHaveLength(3)
  })

  it('keeps first and last on a consortium paper', () => {
    const authors = principalEuropePmcAuthors(record(40))
    expect(authors.map((a) => a.position)).toEqual([1, 40])
  })
})
