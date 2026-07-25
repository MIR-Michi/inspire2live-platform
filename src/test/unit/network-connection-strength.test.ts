/**
 * network — the route model (concept §8).
 *
 * These assertions are the product rules, not implementation details: a
 * two-step route really must cost 15 %, a weak route really must never be
 * offered, and an inferred route really must not claim to be confirmed.
 */

import { describe, it, expect } from 'vitest'
import {
  CONNECTION_STRENGTH,
  connectionTypeForAnswer,
  describeRoute,
  findRoutes,
  rankRoutes,
  routeCategory,
  routeStrength,
  strengthFor,
} from '@/modules/network/domain/connection-strength'
import { DEFAULT_NETWORK_CONFIG } from '@/modules/network/domain/types'
import type { Connection, ConnectionType } from '@/modules/network/domain/types'

const MEMBER = '11111111-1111-1111-1111-111111111111'
const MEMBER_B = '22222222-2222-2222-2222-222222222222'
const MIDDLE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TARGET = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

let seq = 0
function edge(partial: Partial<Connection> & { connectionType: ConnectionType }): Connection {
  return {
    id: `edge-${++seq}`,
    fromType: 'profile',
    fromId: MEMBER,
    toType: 'person',
    toId: TARGET,
    strength: CONNECTION_STRENGTH[partial.connectionType],
    evidence: [],
    status: 'confirmed',
    confirmedBy: null,
    confirmedAt: null,
    ...partial,
  }
}

describe('connection strength vocabulary', () => {
  it('matches the published table exactly (concept §8)', () => {
    expect(CONNECTION_STRENGTH).toEqual({
      knows_well: 0.95,
      published_together: 0.85,
      knows_a_little: 0.65,
      shared_board: 0.6,
      shared_congress_session: 0.45,
      shared_institution: 0.4,
      shared_society: 0.25,
      shared_country: 0.15,
    })
    expect(strengthFor('published_together')).toBe(0.85)
  })

  it('only a yes answer establishes a connection type', () => {
    expect(connectionTypeForAnswer('knows_well')).toBe('knows_well')
    expect(connectionTypeForAnswer('knows_a_little')).toBe('knows_a_little')
    // "I know someone who does" points at a third party; it is not a claim
    // about this pair. "I would rather not ask" is a boundary, not data.
    expect(connectionTypeForAnswer('knows_someone')).toBeNull()
    expect(connectionTypeForAnswer('rather_not')).toBeNull()
    expect(connectionTypeForAnswer('no')).toBeNull()
  })
})

describe('routeStrength', () => {
  it('a one-hop route is just its own strength', () => {
    const [route] = findRoutes(TARGET, [edge({ connectionType: 'knows_well' })])
    expect(route.strength).toBe(0.95)
    expect(route.steps).toBe(1)
  })

  it('a two-step route multiplies and then loses 15 %', () => {
    const hops = [
      { strength: 0.95 },
      { strength: 0.85 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any
    // 0.95 × 0.85 = 0.8075 → ×0.85 = 0.686… → 0.686 (the concept's worked example
    // rounds to 0.69).
    expect(routeStrength(hops)).toBeCloseTo(0.686, 3)
  })

  it('an empty path has no strength', () => {
    expect(routeStrength([])).toBe(0)
  })
})

describe('findRoutes', () => {
  it('finds a direct member → target route regardless of edge direction', () => {
    const reversed = edge({
      connectionType: 'knows_a_little',
      fromType: 'person',
      fromId: TARGET,
      toType: 'profile',
      toId: MEMBER,
    })
    const [route] = findRoutes(TARGET, [reversed])
    expect(route.introducerProfileId).toBe(MEMBER)
    expect(route.hops[0].toId).toBe(TARGET)
    expect(route.strength).toBe(0.65)
  })

  it('walks two steps through a shared contact', () => {
    const routes = findRoutes(TARGET, [
      edge({ connectionType: 'knows_well', toType: 'person', toId: MIDDLE }),
      edge({
        connectionType: 'published_together',
        fromType: 'person',
        fromId: MIDDLE,
        toType: 'person',
        toId: TARGET,
      }),
    ])
    expect(routes).toHaveLength(1)
    expect(routes[0].steps).toBe(2)
    expect(routes[0].introducerProfileId).toBe(MEMBER)
    expect(routes[0].strength).toBeCloseTo(0.686, 3)
  })

  it('never walks three steps — nobody should make that request', () => {
    const far = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const routes = findRoutes(TARGET, [
      edge({ connectionType: 'knows_well', toType: 'person', toId: far }),
      edge({
        connectionType: 'knows_well',
        fromType: 'person',
        fromId: far,
        toType: 'person',
        toId: MIDDLE,
      }),
      edge({
        connectionType: 'knows_well',
        fromType: 'person',
        fromId: MIDDLE,
        toType: 'person',
        toId: TARGET,
      }),
    ])
    expect(routes).toEqual([])
  })

  it('ignores rejected edges entirely', () => {
    const routes = findRoutes(TARGET, [edge({ connectionType: 'knows_well', status: 'rejected' })])
    expect(routes).toEqual([])
  })

  it('keeps a suggested edge but does not call the route confirmed', () => {
    const [route] = findRoutes(TARGET, [
      edge({ connectionType: 'shared_board', status: 'suggested' }),
    ])
    expect(route.confirmed).toBe(false)
    expect(route.strength).toBe(0.6)
  })

  it('a two-step route is confirmed only when every hop is', () => {
    const [route] = findRoutes(TARGET, [
      edge({ connectionType: 'knows_well', toType: 'person', toId: MIDDLE, status: 'confirmed' }),
      edge({
        connectionType: 'knows_well',
        fromType: 'person',
        fromId: MIDDLE,
        toType: 'person',
        toId: TARGET,
        status: 'suggested',
      }),
    ])
    expect(route.confirmed).toBe(false)
  })
})

describe('rankRoutes', () => {
  it('hides anything below the 0.20 floor', () => {
    // shared_country = 0.15 — offering it would waste goodwill.
    const routes = findRoutes(TARGET, [edge({ connectionType: 'shared_country' })])
    expect(routes).toEqual([])
  })

  it('shows at most three routes, strongest first', () => {
    const members = ['m1', 'm2', 'm3', 'm4']
    const types: ConnectionType[] = [
      'shared_society',
      'knows_well',
      'knows_a_little',
      'shared_board',
    ]
    const routes = findRoutes(
      TARGET,
      members.map((m, i) => edge({ connectionType: types[i], fromId: m })),
    )
    expect(routes).toHaveLength(DEFAULT_NETWORK_CONFIG.maxRoutesShown)
    expect(routes.map((r) => r.strength)).toEqual([0.95, 0.65, 0.6])
  })

  it('prefers a confirmed route over an equally strong guess', () => {
    const ranked = rankRoutes([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { introducerProfileId: MEMBER, hops: [], steps: 1, strength: 0.6, confirmed: false, connectionId: null } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { introducerProfileId: MEMBER_B, hops: [], steps: 1, strength: 0.6, confirmed: true, connectionId: null } as any,
    ])
    expect(ranked[0].introducerProfileId).toBe(MEMBER_B)
  })

  it('honours a retuned config — the thresholds are settings, not constants', () => {
    const weak = findRoutes(TARGET, [edge({ connectionType: 'shared_country' })], {
      ...DEFAULT_NETWORK_CONFIG,
      minRouteStrength: 0.1,
    })
    expect(weak).toHaveLength(1)
  })
})

describe('routeCategory', () => {
  it('maps the best route onto the five scoring routes (concept §7)', () => {
    const one = findRoutes(TARGET, [edge({ connectionType: 'knows_well' })])[0]
    expect(routeCategory(one)).toBe('one_introduction')

    const two = findRoutes(TARGET, [
      edge({ connectionType: 'knows_well', toType: 'person', toId: MIDDLE }),
      edge({ connectionType: 'knows_well', fromType: 'person', fromId: MIDDLE, toType: 'person', toId: TARGET }),
    ])[0]
    expect(routeCategory(two)).toBe('two_steps')

    expect(routeCategory(undefined)).toBe('cold_hook')
    // A press office overrides everything: all access runs through it.
    expect(routeCategory(one, { pressOffice: true })).toBe('press_office')
  })
})

describe('describeRoute', () => {
  it('names the people and says whether the route is confirmed', () => {
    const [route] = findRoutes(TARGET, [edge({ connectionType: 'knows_well', status: 'suggested' })])
    const text = describeRoute(route, { [`profile:${MEMBER}`]: 'Ada', [`person:${TARGET}`]: 'Prof. Grace' })
    expect(text).toContain('Ada → Prof. Grace')
    expect(text).toContain('not yet confirmed')
  })
})
