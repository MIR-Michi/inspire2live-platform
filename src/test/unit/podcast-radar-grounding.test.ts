/**
 * podcast-planning — Radar's groundedness rule (ADR-0016 §2).
 *
 * The load-bearing claim of this whole feature is that a suggested person came
 * out of a record rather than out of a model. These tests are that claim, so
 * they are written adversarially: every one of them hands the grounding layer
 * a reply a misbehaving model could plausibly produce, and asserts that the
 * fabricated part does not survive.
 */

import { describe, expect, it } from 'vitest'
import {
  NAMES_SCHEMA,
  NAMES_SYSTEM_PROMPT,
  TOPICS_SCHEMA,
  groundNames,
  groundTopics,
  parseJsonReply,
  rejectedExamplesBlock,
} from '@/modules/podcast-planning/domain/radar-grounding'
import {
  buildMessageRequest,
  getAiWorkloadPolicy,
  getRecommendedSelection,
  sanitizeStructuredSchema,
  validateAiModelEffort,
} from '@/kernel/ai-client'
import {
  MAX_SEARCH_TERMS,
  countIndependentSources,
  dedupeAcrossSources,
  personOptions,
  radarDedupeKey,
  searchTermsForQuestion,
  signalsFromEuropePmc,
  signalsFromWorks,
  wideningSearches,
} from '@/modules/podcast-planning/domain/radar-types'
import type { RadarSignal } from '@/modules/podcast-planning/domain/radar-types'
import type { EuropePmcRecord, OpenAlexWork } from '@/kernel/sources'

function signal(id: string, partial: Partial<RadarSignal> = {}): RadarSignal {
  return {
    id,
    source: 'openalex',
    externalId: `W${id}`,
    title: `Paper ${id}`,
    url: `https://doi.org/10.1/${id}`,
    publishedAt: '2026-07-01',
    people: [
      {
        name: 'Elena Rossi',
        role: 'First author',
        organisation: 'Karolinska',
        country: 'SE',
        externalId: 'A1',
        url: null,
      },
    ],
    discoveredAt: '2026-08-01T00:00:00Z',
    ...partial,
  }
}

describe('groundNames — a suggestion that cannot be traced does not exist', () => {
  const options = personOptions([signal('s1'), signal('s2', {
    externalId: 'W2',
    people: [
      { name: 'Tomas Bergmann', role: 'Senior author', organisation: 'NKI', country: 'NL', externalId: 'A2', url: null },
    ],
  })])

  it('keeps a pick that names somebody it was offered', () => {
    const result = groundNames(
      { picks: [{ ref: options[0].ref, angle: 'Ran the trial whose endpoint the regulator rejected.' }] },
      options,
      { limit: 6 },
    )

    expect(result.names).toHaveLength(1)
    expect(result.names[0].name).toBe(options[0].name)
    expect(result.names[0].signalId).toBe(options[0].signalId)
    expect(result.dropped.unknownRef).toBe(0)
  })

  it('drops a person the model invented, and counts the drop', () => {
    const result = groundNames(
      {
        picks: [
          { ref: 'p99', angle: 'A plausible sentence about a person who does not exist.' },
          { ref: options[0].ref, angle: 'A real one, from a real record.' },
        ],
      },
      options,
      { limit: 6 },
    )

    expect(result.names).toHaveLength(1)
    expect(result.names[0].name).toBe(options[0].name)
    expect(result.dropped.unknownRef).toBe(1)
  })

  it('never takes a name, organisation or country from the reply', () => {
    // The adversarial case: the model answers with a real ref but tries to
    // relabel the person. Only the angle may come from the model.
    const result = groundNames(
      {
        picks: [
          {
            ref: options[0].ref,
            angle: 'What only they could say.',
            name: 'Someone Else Entirely',
            organisation: 'A Made-Up Institute',
            country: 'ZZ',
          },
        ],
      },
      options,
      { limit: 6 },
    )

    expect(result.names[0].name).toBe(options[0].name)
    expect(result.names[0].organisation).toBe(options[0].organisation)
    expect(result.names[0].country).toBe(options[0].country)
    expect(result.names[0].angle).toBe('What only they could say.')
  })

  it('drops a repeated pick rather than suggesting the same person twice', () => {
    const result = groundNames(
      {
        picks: [
          { ref: options[0].ref, angle: 'First attempt at an angle.' },
          { ref: options[0].ref.toUpperCase(), angle: 'Second attempt at an angle.' },
        ],
      },
      options,
      { limit: 6 },
    )

    expect(result.names).toHaveLength(1)
    expect(result.dropped.duplicate).toBe(1)
  })

  it('drops a pick with no usable angle', () => {
    const result = groundNames({ picks: [{ ref: options[0].ref, angle: 'expert' }] }, options, {
      limit: 6,
    })
    expect(result.names).toHaveLength(0)
    expect(result.dropped.noAngle).toBe(1)
  })

  it('honours the shortlist ceiling', () => {
    const many = personOptions(
      Array.from({ length: 8 }, (_, i) =>
        signal(`s${i}`, {
          externalId: `W${i}`,
          people: [
            { name: `Person ${i}`, role: 'First author', organisation: null, country: null, externalId: `A${i}`, url: null },
          ],
        }),
      ),
    )
    const result = groundNames(
      { picks: many.map((o) => ({ ref: o.ref, angle: `Something specific about ${o.ref}.` })) },
      many,
      { limit: 3 },
    )

    expect(result.names).toHaveLength(3)
    expect(result.dropped.overLimit).toBe(5)
  })

  it('survives a reply that is not the shape it was asked for', () => {
    expect(groundNames(null, options, { limit: 6 }).names).toEqual([])
    expect(groundNames({ picks: 'nope' }, options, { limit: 6 }).names).toEqual([])
    expect(groundNames({}, options, { limit: 6 }).names).toEqual([])
  })
})

describe('countIndependentSources — a count, not a claim', () => {
  it('treats papers sharing an author as one source', () => {
    // Five papers from one group are one group publishing five times, and this
    // number is worth six points of timeliness.
    const sameGroup = [signal('a'), signal('b', { externalId: 'Wb' }), signal('c', { externalId: 'Wc' })]
    expect(countIndependentSources(sameGroup)).toBe(1)
  })

  it('counts genuinely separate groups separately', () => {
    const groups = [
      signal('a'),
      signal('b', {
        externalId: 'Wb',
        people: [{ name: 'Tomas Bergmann', role: null, organisation: 'NKI', country: 'NL', externalId: 'A2', url: null }],
      }),
      signal('c', {
        externalId: 'Wc',
        people: [{ name: 'Aisha Haddad', role: null, organisation: 'Gustave Roussy', country: 'FR', externalId: 'A3', url: null }],
      }),
    ]
    expect(countIndependentSources(groups)).toBe(3)
  })

  it('joins two groups through a shared middle author', () => {
    const bridged = [
      signal('a', {
        people: [{ name: 'Elena Rossi', role: null, organisation: null, country: null, externalId: 'A1', url: null }],
      }),
      signal('b', {
        externalId: 'Wb',
        people: [
          { name: 'Elena Rossi', role: null, organisation: null, country: null, externalId: 'A1', url: null },
          { name: 'Tomas Bergmann', role: null, organisation: null, country: null, externalId: 'A2', url: null },
        ],
      }),
      signal('c', {
        externalId: 'Wc',
        people: [{ name: 'Tomas Bergmann', role: null, organisation: null, country: null, externalId: 'A2', url: null }],
      }),
    ]
    expect(countIndependentSources(bridged)).toBe(1)
  })

  it('is not fooled by punctuation or case in a name', () => {
    const same = [
      signal('a', {
        people: [{ name: 'Elena Rossi', role: null, organisation: null, country: null, externalId: null, url: null }],
      }),
      signal('b', {
        externalId: 'Wb',
        people: [{ name: 'elena  rossi', role: null, organisation: null, country: null, externalId: null, url: null }],
      }),
    ]
    expect(countIndependentSources(same)).toBe(1)
  })

  it('is zero for nothing', () => {
    expect(countIndependentSources([])).toBe(0)
  })
})

describe('groundTopics — the source floor is counted, not requested', () => {
  const signals = [
    signal('s1', {
      people: [{ name: 'Elena Rossi', role: null, organisation: 'Karolinska', country: 'SE', externalId: 'A1', url: null }],
      publishedAt: '2026-07-01',
    }),
    signal('s2', {
      externalId: 'W2',
      people: [{ name: 'Tomas Bergmann', role: null, organisation: 'NKI', country: 'NL', externalId: 'A2', url: null }],
      publishedAt: '2026-07-20',
    }),
  ]
  const options = personOptions(signals)

  it('accepts a group that clears the floor and reads as a question', () => {
    const result = groundTopics(
      {
        topics: [
          {
            signalRefs: ['s1', 's2'],
            question: 'Should a surrogate endpoint be enough for reimbursement when survival data is years away?',
            whyNow: 'Two groups published contradicting analyses within a month.',
            whyNowDate: '2026-07-20',
            picks: [{ ref: options[0].ref, angle: 'Ran the analysis that found the discrepancy.' }],
          },
        ],
      },
      signals,
      options,
      { minSources: 2, maxTopics: 10, maxNames: 6 },
    )

    expect(result.topics).toHaveLength(1)
    expect(result.topics[0].independentSources).toBe(2)
    expect(result.topics[0].signalIds).toEqual(['s1', 's2'])
    expect(result.topics[0].names).toHaveLength(1)
  })

  it('drops a group that does not reach the floor once the records are resolved', () => {
    const result = groundTopics(
      {
        topics: [
          {
            signalRefs: ['s1', 's99', 's98'],
            question: 'Should a surrogate endpoint be enough for reimbursement in this setting?',
            whyNow: 'Claimed to rest on three sources.',
            picks: [],
          },
        ],
      },
      signals,
      options,
      { minSources: 2, maxTopics: 10, maxNames: 6 },
    )

    expect(result.topics).toHaveLength(0)
    expect(result.dropped.tooFewSources).toBe(1)
    expect(result.dropped.unknownRef).toBe(2)
  })

  it('drops a subject area dressed up as a topic', () => {
    const result = groundTopics(
      {
        topics: [
          {
            signalRefs: ['s1', 's2'],
            question: 'Advances in oncology',
            whyNow: 'Lots of papers.',
            picks: [],
          },
        ],
      },
      signals,
      options,
      { minSources: 2, maxTopics: 10, maxNames: 6 },
    )

    expect(result.topics).toHaveLength(0)
    expect(result.dropped.notAQuestion).toBe(1)
  })

  it('never dates a why-now later than its own evidence', () => {
    // Otherwise an ageing topic keeps looking urgent, because `whyNowAt` is
    // what the timeliness decay reads.
    const result = groundTopics(
      {
        topics: [
          {
            signalRefs: ['s1', 's2'],
            question: 'Why does reimbursement still lag approval by two years in smaller markets?',
            whyNow: 'Two independent analyses.',
            whyNowDate: '2026-12-31',
            picks: [],
          },
        ],
      },
      signals,
      options,
      { minSources: 2, maxTopics: 10, maxNames: 6 },
    )

    expect(result.topics[0].whyNowAt).toBe('2026-07-20')
  })

  it('will not let a topic pick somebody from a different topic’s records', () => {
    // This person was named by s2, and the topic below cites only s1.
    const elsewhere = options.find((o) => o.signalId === 's2')!
    const result = groundTopics(
      {
        topics: [
          {
            signalRefs: ['s1'],
            question: 'Should a surrogate endpoint be enough for reimbursement here?',
            whyNow: 'One analysis.',
            picks: [{ ref: elsewhere.ref, angle: 'Borrowed from a record this topic never cited.' }],
          },
        ],
      },
      signals,
      options,
      { minSources: 1, maxTopics: 10, maxNames: 6 },
    )

    expect(result.topics).toHaveLength(1)
    expect(result.topics[0].names).toHaveLength(0)
  })
})

describe('personOptions', () => {
  it('collapses one person across records and counts how many named them', () => {
    const options = personOptions([signal('a'), signal('b', { externalId: 'Wb', publishedAt: '2026-08-01' })])
    expect(options).toHaveLength(1)
    expect(options[0].sourceCount).toBe(2)
    // The citation follows the most recent record.
    expect(options[0].signalId).toBe('b')
  })

  it('ranks by weight of evidence, so truncation drops the weakest', () => {
    const options = personOptions(
      [
        signal('a'),
        signal('b', { externalId: 'Wb' }),
        signal('c', {
          externalId: 'Wc',
          people: [{ name: 'Solo Author', role: null, organisation: null, country: null, externalId: 'A9', url: null }],
        }),
      ],
      { limit: 1 },
    )
    expect(options).toHaveLength(1)
    expect(options[0].name).toBe('Elena Rossi')
  })
})

describe('signalsFromWorks', () => {
  const work: OpenAlexWork = {
    id: 'W1',
    title: 'Surrogate endpoints and reimbursement in metastatic disease',
    doi: 'https://doi.org/10.1/x',
    publicationDate: '2026-07-01',
    url: 'https://doi.org/10.1/x',
    venue: 'The Lancet Oncology',
    citedByCount: 3,
    isOpenAccess: true,
    type: 'article',
    authors: [
      { id: 'A1', name: 'First A', orcid: null, position: 'first', organisation: 'Karolinska', country: 'SE', isCorresponding: false },
      { id: 'A2', name: 'Middle B', orcid: null, position: 'middle', organisation: null, country: null, isCorresponding: false },
      { id: 'A3', name: 'Middle C', orcid: null, position: 'middle', organisation: null, country: null, isCorresponding: false },
      { id: 'A4', name: 'Last D', orcid: '0000-0002-1825-0097', position: 'last', organisation: 'NKI', country: 'NL', isCorresponding: true },
    ],
  }

  it('carries only the authors who can speak for the work', () => {
    const [result] = signalsFromWorks([work])
    expect(result.people.map((p) => p.name)).toEqual(['First A', 'Last D'])
    expect(result.people[0].role).toBe('First author')
    expect(result.people[1].role).toBe('Senior author')
    expect(result.people[1].url).toBe('https://orcid.org/0000-0002-1825-0097')
  })

  it('keeps every author on a small team, where the convention does not apply', () => {
    const small: OpenAlexWork = { ...work, authors: work.authors.slice(0, 3) }
    expect(signalsFromWorks([small])[0].people).toHaveLength(3)
  })

  it('drops the supplementary artefacts OpenAlex indexes alongside papers', () => {
    // Seen on the first live run: an interview guide attached to a study,
    // markup intact. Its authors are not podcast guests.
    const artefact: OpenAlexWork = {
      ...work,
      id: 'W2',
      title: '<p>Interview guide for patients and relatives.</p>',
    }
    const stub: OpenAlexWork = { ...work, id: 'W3', title: 'Fig. 1' }
    const authorless: OpenAlexWork = { ...work, id: 'W4', authors: [] }

    expect(signalsFromWorks([work, artefact, stub, authorless]).map((s) => s.externalId)).toEqual([
      'W1',
    ])
  })
})

describe('radarDedupeKey', () => {
  it('is stable across case and whitespace, so a re-run converges on one row', () => {
    expect(radarDedupeKey('openalex', 'W123')).toBe(radarDedupeKey('openalex', ' w123 '))
  })

  it('separates the same identifier from different sources', () => {
    expect(radarDedupeKey('openalex', 'X')).not.toBe(radarDedupeKey('europepmc', 'X'))
  })
})

describe('searchTermsForQuestion', () => {
  it('prefers the tags somebody chose', () => {
    expect(searchTermsForQuestion('Should this be different?', ['surrogate endpoints', 'reimbursement'])).toBe(
      'surrogate endpoints reimbursement',
    )
  })

  it('falls back to the content words, dropping the question-shaped ones', () => {
    const terms = searchTermsForQuestion('Why should surrogate endpoints still decide reimbursement?')
    expect(terms).not.toContain('should')
    expect(terms).not.toContain('why')
    expect(terms).toContain('surrogate')
    expect(terms).toContain('reimbursement')
  })

  it('is empty for a question with nothing searchable in it', () => {
    expect(searchTermsForQuestion('Why not?')).toBe('')
  })

  it('never exceeds the measured term ceiling', () => {
    // Every term is ANDed by the index. Five words out of a real question
    // returned one paper where three returned 138.
    const long = searchTermsForQuestion(
      'Should surrogate endpoints decide reimbursement before overall survival data exists anywhere?',
    )
    expect(long.split(' ')).toHaveLength(MAX_SEARCH_TERMS)
  })
})

describe('wideningSearches', () => {
  it('goes narrowest to broadest and keeps the anchor throughout', () => {
    expect(wideningSearches('surrogate endpoint enough', 'cancer')).toEqual([
      'cancer surrogate endpoint enough',
      'cancer surrogate endpoint',
      'cancer surrogate',
    ])
  })

  it('never widens to the anchor alone — a subject area retrieves everything', () => {
    expect(wideningSearches('surrogate', 'cancer')).toEqual(['cancer surrogate'])
  })

  it('does not repeat the anchor when the question already contains it', () => {
    expect(wideningSearches('cancer screening', 'cancer')).toEqual(['cancer screening'])
  })

  it('still works with no anchor configured', () => {
    expect(wideningSearches('surrogate endpoint', null)).toEqual(['surrogate endpoint', 'surrogate'])
  })
})

describe('signalsFromEuropePmc', () => {
  const record: EuropePmcRecord = {
    id: '42298374',
    source: 'MED',
    title: 'Intermediate clinical endpoints as surrogates for overall survival',
    doi: '10.1111/bju.70352',
    publicationDate: '2026-06-15',
    url: 'https://doi.org/10.1111/bju.70352',
    journal: 'BJU International',
    publicationTypes: ['multicenter study', 'journal article'],
    isPreprint: false,
    citedByCount: 4,
    authors: [
      { name: 'Roessler N', orcid: '0000-0002-1825-0097', organisation: 'Charité', position: 1 },
      { name: 'Middle M', orcid: null, organisation: 'Elsewhere', position: 2 },
      { name: 'Vale C', orcid: null, organisation: 'UCL', position: 3 },
      { name: 'Senior S', orcid: null, organisation: 'Karolinska', position: 4 },
    ],
  }

  it('keeps the ends of the author list and labels them', () => {
    const [signal] = signalsFromEuropePmc([record])
    expect(signal.source).toBe('europepmc')
    // Namespaced, because a bare numeric id collides across Europe PMC's sources.
    expect(signal.externalId).toBe('MED/42298374')
    expect(signal.people.map((p) => [p.name, p.role])).toEqual([
      ['Roessler N', 'First author'],
      ['Senior S', 'Senior author'],
    ])
  })

  it('carries the DOI, which is the only thing that can spot a duplicate later', () => {
    expect(signalsFromEuropePmc([record])[0].payload?.doi).toBe('10.1111/bju.70352')
  })

  it('keeps preprints but says so', () => {
    const preprint: EuropePmcRecord = { ...record, id: 'PPR1', source: 'PPR', isPreprint: true }
    const [signal] = signalsFromEuropePmc([preprint])
    expect(signal.payload?.isPreprint).toBe(true)
  })
})

describe('dedupeAcrossSources', () => {
  const of = (source: 'openalex' | 'europepmc', id: string, doi: string | null) => ({
    source,
    externalId: id,
    title: `Paper ${id}`,
    url: 'https://example.org',
    publishedAt: '2026-06-01',
    people: [],
    payload: doi ? { doi } : {},
  })

  it('collapses one paper both catalogues indexed, keeping the richer record', () => {
    const out = dedupeAcrossSources([
      of('europepmc', 'MED/1', '10.1111/x'),
      of('openalex', 'W1', 'https://doi.org/10.1111/X'),
    ])
    expect(out).toHaveLength(1)
    // OpenAlex wins: it is the one that carries author ids and countries.
    expect(out[0].source).toBe('openalex')
  })

  it('keeps records that genuinely differ', () => {
    expect(
      dedupeAcrossSources([of('openalex', 'W1', '10.1/a'), of('europepmc', 'MED/2', '10.1/b')]),
    ).toHaveLength(2)
  })

  it('never merges records that simply have no DOI', () => {
    expect(
      dedupeAcrossSources([of('europepmc', 'MED/1', null), of('europepmc', 'MED/2', null)]),
    ).toHaveLength(2)
  })
})

describe('rejectedExamplesBlock', () => {
  it('is empty when nothing has been turned down', () => {
    expect(rejectedExamplesBlock([])).toBe('')
  })

  it('is byte-identical whatever order the dismissals arrive in', () => {
    // This text sits in the cached prompt prefix. An unstable prefix is billed
    // at the write rate on every lane of every run.
    const a = [
      { question: 'Why B?', reason: 'off_agenda' },
      { question: 'Why A?', reason: 'not_a_question' },
    ]
    expect(rejectedExamplesBlock(a)).toBe(rejectedExamplesBlock([...a].reverse()))
  })

  it('explains each refusal in words the model can act on', () => {
    expect(rejectedExamplesBlock([{ question: 'Why A?', reason: 'already_covered' }])).toContain(
      'already covered',
    )
  })

  it('survives a reason the enum no longer has', () => {
    const block = rejectedExamplesBlock([{ question: 'Why A?', reason: 'retired_reason' }])
    expect(block).toContain('Why A?')
    expect(block).not.toContain('undefined')
  })

  it('drops repeats and caps the list', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      question: `Question ${String(i).padStart(2, '0')}?`,
      reason: 'off_agenda',
    }))
    const lines = rejectedExamplesBlock([...many, ...many]).split('\n').filter((l) => l.startsWith('- '))
    expect(lines).toHaveLength(12)
    expect(new Set(lines).size).toBe(12)
  })
})

describe('the request the provider is actually sent', () => {
  // Anthropic rejects a structured-output schema carrying validation keywords
  // ("property 'maxItems' is not supported"), and that rejection would only
  // ever be seen by an unattended cron. Building the request here is the
  // cheapest place to find out.
  it('builds a valid names request with a schema the provider accepts', () => {
    const request = buildMessageRequest(
      {
        feature: 'podcast_radar_names',
        workload: 'podcast_radar_names',
        system: NAMES_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'the question and the people' }],
        structuredFormat: {
          type: 'json_schema',
          name: 'radar_names',
          schema: NAMES_SCHEMA,
        },
        maxTokens: 2000,
      },
      { apiKey: 'test', model: 'claude-sonnet-5', effort: 'low', source: 'environment' },
    )

    expect(request.model).toBe('claude-sonnet-5')
    expect(request.max_tokens).toBe(2000)
    expect(JSON.stringify(request)).not.toMatch(/maxItems|minItems|minLength|uniqueItems/)
  })

  it('registers both Radar workloads with an allowed model and effort', () => {
    for (const workload of ['podcast_radar_names', 'podcast_radar_topics'] as const) {
      const policy = getAiWorkloadPolicy(workload)
      expect(policy, `${workload} is not in the catalog`).not.toBeNull()
      const selection = getRecommendedSelection(workload)
      expect(validateAiModelEffort(selection.model, selection.effort)).toEqual({ ok: true })
    }
  })

  it('keeps the topics schema provider-safe too', () => {
    expect(JSON.stringify(sanitizeStructuredSchema(TOPICS_SCHEMA))).not.toMatch(
      /maxItems|minItems|minLength|uniqueItems/,
    )
  })
})

describe('parseJsonReply', () => {
  it('reads a bare object', () => {
    expect(parseJsonReply('{"picks":[]}')).toEqual({ picks: [] })
  })

  it('reads a fenced block, which is what a tool-using call tends to return', () => {
    expect(parseJsonReply('Here you go:\n```json\n{"picks":[]}\n```')).toEqual({ picks: [] })
  })

  it('reads an object buried in prose', () => {
    expect(parseJsonReply('I found these: {"picks":[]} — hope that helps.')).toEqual({ picks: [] })
  })

  it('returns null rather than throwing on nonsense', () => {
    expect(parseJsonReply('sorry, I cannot help with that')).toBeNull()
  })
})
