/**
 * network/domain/routes.ts — the composed route lookup.
 *
 * Joins the stored graph (repository) to the pure route model
 * (connection-strength) and to the human names needed to render a path. Kept
 * separate from both so the arithmetic stays unit-testable without a database.
 */

import { createClient } from '@/kernel/data/server'
import { loadConnectionsForPerson } from '@/modules/network/domain/repository'
import { findRoutes, type Route } from '@/modules/network/domain/connection-strength'
import { resolveNetworkConfig } from '@/modules/network/domain/config'
import type { NetworkConfig } from '@/modules/network/domain/types'

export type NamedRoute = Route & {
  /** Display names for each node, keyed `profile:<id>` / `person:<id>`. */
  names: Record<string, string>
  introducerName: string
}

/**
 * The best routes to one person, ranked, capped and named.
 *
 * Returns an empty list rather than throwing when the graph is unreachable —
 * "no route found" is a legitimate, common answer that the card must show.
 */
export async function loadRoutesForPerson(
  personId: string,
  config?: NetworkConfig,
): Promise<NamedRoute[]> {
  const resolved = config ?? (await resolveNetworkConfig())
  const connections = await loadConnectionsForPerson(personId)
  const routes = findRoutes(personId, connections, resolved)
  if (routes.length === 0) return []

  const names = await resolveNodeNames(routes)
  return routes.map((route) => ({
    ...route,
    names,
    introducerName: names[`profile:${route.introducerProfileId}`] ?? 'A member',
  }))
}

/** Names for every node appearing in a set of routes: one query per node type. */
async function resolveNodeNames(routes: Route[]): Promise<Record<string, string>> {
  const profileIds = new Set<string>()
  const personIds = new Set<string>()
  for (const route of routes) {
    for (const hop of route.hops) {
      for (const node of [
        { type: hop.fromType, id: hop.fromId },
        { type: hop.toType, id: hop.toId },
      ]) {
        if (node.type === 'profile') profileIds.add(node.id)
        else personIds.add(node.id)
      }
    }
  }

  const names: Record<string, string> = {}
  const supabase = await createClient()

  if (profileIds.size > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', [...profileIds])
    if (error) console.error('[network] resolveNodeNames(profiles) failed:', error.message)
    for (const row of data ?? []) {
      names[`profile:${row.id}`] = row.name ?? row.email ?? 'A member'
    }
  }

  if (personIds.size > 0) {
    const { loadPeopleByIds } = await import('@/modules/network/domain/repository')
    const people = await loadPeopleByIds([...personIds])
    for (const [id, person] of people) names[`person:${id}`] = person.fullName
  }

  return names
}
