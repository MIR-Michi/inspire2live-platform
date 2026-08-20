/**
 * podcast-planning — the retention promise, and the dry run that lets somebody
 * check it before trusting it.
 *
 * A job that destroys data on a schedule earns exactly one kind of test: proof
 * that it destroys what it said it would and nothing else, and proof that the
 * rehearsal is genuinely a rehearsal. The second matters more than it looks —
 * an operator running the first real purge has no other way to find out how
 * many rows are about to go.
 */

import { describe, expect, it } from 'vitest'
import { anonymiseClosedCards, asksForRehearsal } from '@/modules/podcast-planning/domain/retention'
import type { PlanningClient } from '@/modules/podcast-planning/domain/radar-repository'

type Write = { table: string; patch: Record<string, unknown>; ids: string[] }

/**
 * A client that records writes instead of performing them. Chainable because
 * the query builder is, and thenable because the call sites await the chain
 * rather than a terminal method.
 */
function fakeDb(rows: Array<{ id: string }>) {
  const writes: Write[] = []
  const filters: string[] = []

  const client = {
    from(table: string) {
      const selectChain: Record<string, unknown> = {
        then: (resolve: (v: { data: typeof rows; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      }
      for (const method of ['select', 'eq', 'lt', 'not', 'is']) {
        selectChain[method] = (...args: unknown[]) => {
          filters.push(`${method}(${args.map(String).join(',')})`)
          return selectChain
        }
      }
      selectChain.update = (patch: Record<string, unknown>) => ({
        in: (_column: string, ids: string[]) => {
          writes.push({ table, patch, ids })
          return { then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }) }
        },
      })
      return selectChain
    },
  }

  return { db: client as unknown as PlanningClient, writes, filters }
}

describe('asksForRehearsal — the guard that decides whether rows die', () => {
  // The bug this exists to prevent: the route once accepted `1` and nothing
  // else, so the spelling almost everyone reaches for ran a live purge.
  it.each(['1', 'true', 'TRUE', 'yes', '', 'on', 'please'])(
    'treats %o as a rehearsal',
    (value) => {
      expect(asksForRehearsal(value)).toBe(true)
    },
  )

  it.each(['0', 'false', 'FALSE', 'no', ' no '])('treats %o as an explicit go-ahead', (value) => {
    expect(asksForRehearsal(value)).toBe(false)
  })

  it('goes ahead when the parameter is absent, which is what the scheduler sends', () => {
    expect(asksForRehearsal(null)).toBe(false)
  })
})

describe('anonymiseClosedCards', () => {
  it('rehearses without writing, and says how many it would have touched', async () => {
    const { db, writes } = fakeDb([{ id: 'c1' }, { id: 'c2' }])

    const result = await anonymiseClosedCards(db, { months: 12, dryRun: true })

    expect(writes).toHaveLength(0)
    expect(result.scanned).toBe(2)
    expect(result.anonymised).toBe(0)
    expect(result.message).toMatch(/Would anonymise 2 cards/)
    expect(result.message).toMatch(/Nothing was changed/)
  })

  it('clears the person and the free text, and keeps the closed reason', async () => {
    const { db, writes } = fakeDb([{ id: 'c1' }])

    const result = await anonymiseClosedCards(db, { months: 12 })

    expect(writes).toHaveLength(1)
    expect(writes[0].ids).toEqual(['c1'])
    // The card becomes a tally mark: everything that identifies a person goes.
    expect(writes[0].patch).toMatchObject({
      person_id: '00000000-0000-0000-0000-000000000000',
      angle: null,
      closed_note: null,
      override_reason: null,
    })
    // The one thing scoring learns from must survive, or the model quietly degrades.
    expect(writes[0].patch).not.toHaveProperty('closed_reason')
    expect(result.anonymised).toBe(1)
  })

  it('writes nothing when there is nothing old enough', async () => {
    const { db, writes } = fakeDb([])

    const result = await anonymiseClosedCards(db, { months: 12 })

    expect(writes).toHaveLength(0)
    expect(result).toMatchObject({ scanned: 0, anonymised: 0 })
  })

  it('only ever considers closed cards that still hold a person', async () => {
    const { db, filters } = fakeDb([])

    await anonymiseClosedCards(db, { months: 12 })

    expect(filters.join(' ')).toContain("eq(stage,closed)")
    expect(filters.join(' ')).toContain('not(person_id,is,null)')
    // An open card must never be reachable by this job, whatever its age.
    expect(filters.some((f) => f.startsWith('lt(closed_at'))).toBe(true)
  })
})
