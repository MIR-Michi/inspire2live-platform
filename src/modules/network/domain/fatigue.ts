/**
 * network/domain/fatigue.ts — not wearing people out.
 *
 * Concept §8. Introducers are finite and their relationships are not
 * organisational property. Three rules are enforced in the product rather than
 * left to good manners:
 *
 *  1. Nobody receives more than one *favour* request per cooldown window.
 *  2. Any request can be declined without explanation and without visible
 *     consequence — a decline is not a strike and never blocks anybody.
 *  3. Each person's request history is visible, so nobody is quietly over-drawn.
 *
 * The cheap map question is deliberately *not* throttled here: it commits
 * nobody, moves no card, and can go to several people at once. Throttling it
 * would be the fastest way to stop the map ever getting built (concept §8,
 * "two separate asks, in this order").
 */

import type { IntroductionRequest, NetworkConfig } from '@/modules/network/domain/types'
import { DEFAULT_NETWORK_CONFIG } from '@/modules/network/domain/types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days between two instants, floored. */
export function daysBetween(from: string | Date, to: string | Date = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS)
}

export type FatigueVerdict =
  | { allowed: true; lastRequestAt: string | null; daysSinceLast: number | null }
  | { allowed: false; reason: 'cooldown'; lastRequestAt: string; daysUntilAvailable: number }

/**
 * May this introducer be asked for a favour right now?
 *
 * Only *requests we made* count against the window. A declined request counts
 * exactly like an accepted one — the cost to the introducer was the asking, not
 * the answer — which is what makes "decline freely" true rather than polite.
 */
export function canRequestIntroduction(
  history: IntroductionRequest[],
  opts: { now?: Date; config?: NetworkConfig } = {},
): FatigueVerdict {
  const now = opts.now ?? new Date()
  const config = opts.config ?? DEFAULT_NETWORK_CONFIG

  const last = [...history].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  )[0]

  if (!last) return { allowed: true, lastRequestAt: null, daysSinceLast: null }

  const elapsed = daysBetween(last.requestedAt, now)
  if (elapsed < config.introducerCooldownDays) {
    return {
      allowed: false,
      reason: 'cooldown',
      lastRequestAt: last.requestedAt,
      daysUntilAvailable: config.introducerCooldownDays - elapsed,
    }
  }

  return { allowed: true, lastRequestAt: last.requestedAt, daysSinceLast: elapsed }
}

export type IntroducerLoad = {
  profileId: string
  /** Requests made in the current cooldown window. */
  recent: number
  /** Requests ever made to this person. */
  total: number
  /** Introductions that actually happened. Recognition, not a leaderboard. */
  doorsOpened: number
  lastRequestAt: string | null
  available: boolean
  daysUntilAvailable: number
}

/**
 * Per-introducer load for the Introductions screen.
 *
 * `doorsOpened` is recorded and shown as recognition. It is deliberately not a
 * ranking input anywhere in this component: ranking people by favours asked
 * would corrode exactly the culture that makes the network work at all.
 */
export function summariseIntroducerLoad(
  requests: IntroductionRequest[],
  opts: { now?: Date; config?: NetworkConfig } = {},
): IntroducerLoad[] {
  const now = opts.now ?? new Date()
  const config = opts.config ?? DEFAULT_NETWORK_CONFIG

  const byIntroducer = new Map<string, IntroductionRequest[]>()
  for (const r of requests) {
    byIntroducer.set(r.introducerProfileId, [...(byIntroducer.get(r.introducerProfileId) ?? []), r])
  }

  return [...byIntroducer.entries()]
    .map(([profileId, list]) => {
      const verdict = canRequestIntroduction(list, { now, config })
      const lastRequestAt = verdict.allowed ? verdict.lastRequestAt : verdict.lastRequestAt
      return {
        profileId,
        recent: list.filter((r) => daysBetween(r.requestedAt, now) < config.introducerCooldownDays).length,
        total: list.length,
        doorsOpened: list.filter((r) => r.introSentAt !== null).length,
        lastRequestAt,
        available: verdict.allowed,
        daysUntilAvailable: verdict.allowed ? 0 : verdict.daysUntilAvailable,
      }
    })
    .sort((a, b) => a.profileId.localeCompare(b.profileId))
}
