/**
 * network/domain/connection-strength.ts — the route model.
 *
 * Pure arithmetic over stored edges: no I/O, no model call. Concept §8.
 *
 * The rules it encodes, all of them deliberate:
 *  - a connection's strength comes from *how it is known*, not from a guess;
 *  - a two-step route multiplies its links and then loses 15 %, because asking
 *    somebody to ask somebody else really does cost more;
 *  - routes below the configured floor are never offered, since a weak route
 *    wastes goodwill on a request that was never going to work;
 *  - a route built only from inferred edges is a *guess*, and says so — the
 *    platform never claims two people know each other unless a human confirmed it.
 */

import type {
  Connection,
  ConnectionCheckAnswer,
  ConnectionType,
  NetworkConfig,
  NodeType,
} from '@/modules/network/domain/types'
import { DEFAULT_NETWORK_CONFIG } from '@/modules/network/domain/types'

/**
 * The strength vocabulary (concept §8). Strength is a property of the *kind* of
 * connection, so it is derived here and denormalised on write — never typed in
 * by hand.
 */
export const CONNECTION_STRENGTH: Record<ConnectionType, number> = {
  knows_well: 0.95,
  published_together: 0.85,
  knows_a_little: 0.65,
  shared_board: 0.6,
  shared_congress_session: 0.45,
  shared_institution: 0.4,
  shared_society: 0.25,
  shared_country: 0.15,
}

export const CONNECTION_TYPE_META: Record<
  ConnectionType,
  { label: string; evidence: string; /** True when the edge can only exist because a human said so. */ human: boolean }
> = {
  knows_well: { label: 'Knows them well', evidence: 'Confirmed by the member', human: true },
  published_together: { label: 'Published together', evidence: 'Co-authorship, verifiable', human: false },
  knows_a_little: { label: 'Knows them a little', evidence: 'Confirmed by the member', human: true },
  shared_board: { label: 'Same board or committee', evidence: 'Small group, repeated contact', human: false },
  shared_congress_session: { label: 'Same congress session', evidence: 'Published programme', human: false },
  shared_institution: { label: 'Same institution, overlapping years', evidence: 'Declared plus public', human: false },
  shared_society: { label: 'Same professional society', evidence: 'Weak alone, useful as corroboration', human: false },
  shared_country: { label: 'Same country or hub', evidence: 'Context only', human: false },
}

/** Strength for a connection type. */
export function strengthFor(type: ConnectionType): number {
  return CONNECTION_STRENGTH[type]
}

/**
 * The connection type a map answer establishes, if any.
 *
 * `knows_someone` and `rather_not` deliberately create no edge: the first is a
 * pointer to a third party rather than a claim about this pair, and the second
 * is a boundary, not a data point about the relationship.
 */
export function connectionTypeForAnswer(answer: ConnectionCheckAnswer): ConnectionType | null {
  if (answer === 'knows_well') return 'knows_well'
  if (answer === 'knows_a_little') return 'knows_a_little'
  return null
}

/** One hop of a route. */
export type RouteHop = {
  fromType: NodeType
  fromId: string
  toType: NodeType
  toId: string
  connectionType: ConnectionType
  strength: number
  confirmed: boolean
  evidenceSummary: string
}

/** A ranked path from a member of the organisation to the target person. */
export type Route = {
  /** The member who opens the door — always the first hop's origin. */
  introducerProfileId: string
  hops: RouteHop[]
  /** 1 = direct introduction, 2 = the introducer asks somebody else. */
  steps: 1 | 2
  /** Product of the hops, with the two-step discount applied. */
  strength: number
  /** True only when every hop was confirmed by a human. */
  confirmed: boolean
  /** The connection id to attach to an introduction request (the first hop). */
  connectionId: string | null
}

function hopFrom(c: Connection, reversed: boolean): RouteHop {
  return {
    fromType: reversed ? c.toType : c.fromType,
    fromId: reversed ? c.toId : c.fromId,
    toType: reversed ? c.fromType : c.toType,
    toId: reversed ? c.fromId : c.toId,
    connectionType: c.connectionType,
    strength: c.strength,
    confirmed: c.status === 'confirmed',
    evidenceSummary: c.evidence[0]?.detail ?? CONNECTION_TYPE_META[c.connectionType].evidence,
  }
}

/** Rounds to three decimals so equal routes compare equal and UI stays stable. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Strength of a whole path. One hop is its own strength; two hops multiply and
 * then take the configured discount.
 */
export function routeStrength(hops: RouteHop[], config: NetworkConfig = DEFAULT_NETWORK_CONFIG): number {
  if (hops.length === 0) return 0
  const product = hops.reduce((acc, h) => acc * h.strength, 1)
  return round3(hops.length > 1 ? product * config.twoStepDiscount : product)
}

/**
 * Find and rank the routes from the organisation's members to one target person.
 *
 * Walks at most two hops, because a three-step introduction is a request nobody
 * should make. Rejected edges are ignored entirely; suggested edges are kept but
 * mark the route unconfirmed, which is what the map question then resolves.
 */
export function findRoutes(
  targetPersonId: string,
  connections: Connection[],
  config: NetworkConfig = DEFAULT_NETWORK_CONFIG,
): Route[] {
  const usable = connections.filter((c) => c.status !== 'rejected')

  /** Every edge touching a node, oriented away from it. */
  const outgoing = new Map<string, Array<{ conn: Connection; reversed: boolean }>>()
  const key = (type: NodeType, id: string) => `${type}:${id}`
  for (const c of usable) {
    const a = key(c.fromType, c.fromId)
    const b = key(c.toType, c.toId)
    outgoing.set(a, [...(outgoing.get(a) ?? []), { conn: c, reversed: false }])
    outgoing.set(b, [...(outgoing.get(b) ?? []), { conn: c, reversed: true }])
  }

  const target = key('person', targetPersonId)
  const routes: Route[] = []

  // Step 1 — a member who is directly connected to the target.
  const direct = (outgoing.get(target) ?? []).filter((e) => {
    const other = e.reversed ? { type: e.conn.fromType, id: e.conn.fromId } : { type: e.conn.toType, id: e.conn.toId }
    return other.type === 'profile'
  })

  for (const edge of direct) {
    // Orient the hop member → target.
    const memberIsFrom = edge.conn.fromType === 'profile'
    const hop = hopFrom(edge.conn, !memberIsFrom)
    routes.push({
      introducerProfileId: hop.fromId,
      hops: [hop],
      steps: 1,
      strength: routeStrength([hop], config),
      confirmed: hop.confirmed,
      connectionId: edge.conn.id,
    })
  }

  // Step 2 — a member connected to somebody who is connected to the target.
  const viaPeople = (outgoing.get(target) ?? []).filter((e) => {
    const other = e.reversed ? { type: e.conn.fromType, id: e.conn.fromId } : { type: e.conn.toType, id: e.conn.toId }
    return other.type === 'person' && other.id !== targetPersonId
  })

  for (const second of viaPeople) {
    const middle = second.reversed
      ? { type: second.conn.fromType, id: second.conn.fromId }
      : { type: second.conn.toType, id: second.conn.toId }

    const firstEdges = (outgoing.get(key(middle.type, middle.id)) ?? []).filter((e) => {
      const other = e.reversed ? { type: e.conn.fromType, id: e.conn.fromId } : { type: e.conn.toType, id: e.conn.toId }
      return other.type === 'profile'
    })

    for (const first of firstEdges) {
      const memberIsFrom = first.conn.fromType === 'profile'
      const hopA = hopFrom(first.conn, !memberIsFrom)
      // Orient the second hop middle → target.
      const middleIsFrom = second.conn.fromId === middle.id && second.conn.fromType === middle.type
      const hopB = hopFrom(second.conn, !middleIsFrom)
      const hops = [hopA, hopB]
      routes.push({
        introducerProfileId: hopA.fromId,
        hops,
        steps: 2,
        strength: routeStrength(hops, config),
        confirmed: hops.every((h) => h.confirmed),
        connectionId: first.conn.id,
      })
    }
  }

  return rankRoutes(routes, config)
}

/**
 * Order routes and cut the ones not worth offering: strongest first, a confirmed
 * route ahead of an equally strong guess, then fewer steps.
 */
export function rankRoutes(routes: Route[], config: NetworkConfig = DEFAULT_NETWORK_CONFIG): Route[] {
  return routes
    .filter((r) => r.strength >= config.minRouteStrength)
    .sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength
      if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1
      return a.steps - b.steps
    })
    .slice(0, config.maxRoutesShown)
}

/**
 * The route category a candidate card should carry, given the best available
 * route. Mirrors the five routes in concept §7 so the score and the map agree.
 *
 * `already_known` is not derived here: it is a fact about the *organisation's*
 * relationship (past guest, ambassador, active partner) rather than about the
 * graph, and it is set from the person's origin by the consuming component.
 */
export function routeCategory(
  best: Route | undefined,
  opts: { pressOffice?: boolean; hasPublicHook?: boolean } = {},
): 'one_introduction' | 'two_steps' | 'cold_hook' | 'press_office' {
  if (opts.pressOffice) return 'press_office'
  if (best && best.steps === 1) return 'one_introduction'
  if (best && best.steps === 2) return 'two_steps'
  return 'cold_hook'
}

/** Human sentence for a route, used on the card and in the introducer's package. */
export function describeRoute(route: Route, names: Record<string, string> = {}): string {
  const label = (type: NodeType, id: string) => names[`${type}:${id}`] ?? (type === 'profile' ? 'a member' : 'their contact')
  const parts = route.hops.map(
    (h) => `${label(h.fromType, h.fromId)} → ${label(h.toType, h.toId)} (${CONNECTION_TYPE_META[h.connectionType].label.toLowerCase()}, ${h.strength})`,
  )
  const qualifier = route.confirmed ? 'confirmed' : 'not yet confirmed'
  return `${parts.join(' · ')} — route ${route.strength}, ${qualifier}`
}
