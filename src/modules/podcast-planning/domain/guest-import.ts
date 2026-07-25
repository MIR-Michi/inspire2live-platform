/**
 * podcast-planning/domain/guest-import.ts — where the old Guests tab goes.
 *
 * The Guests tab is removed, but nothing is deleted (concept §1). Past guests
 * move into the People list, where they become the most valuable records in the
 * system: a proven willingness to appear, a known relationship, and one of the
 * best possible introducers for the next guest.
 *
 * The extraction is a pure function so it can be tested without a database — the
 * import action below simply feeds its output to `network`'s upsert, which is
 * idempotent by name.
 */

import type { PersonInput } from '@/modules/network'

/** One episode as the events component stores it. */
export type EpisodeGuestSource = {
  id: string
  title: string
  startDate: string
  guests: string[] | null
}

export type ImportableGuest = {
  fullName: string
  episodeCount: number
  latestDate: string
  latestTitle: string
  episodeIds: string[]
}

/**
 * Collapse an episode list into one record per guest.
 *
 * Names are matched case- and whitespace-insensitively but stored in the form
 * they were first written — the display name is somebody's name, not a key.
 */
export function extractPastGuests(episodes: EpisodeGuestSource[]): ImportableGuest[] {
  const byKey = new Map<string, ImportableGuest>()

  for (const episode of episodes) {
    for (const raw of episode.guests ?? []) {
      const name = raw?.trim()
      if (!name) continue
      const key = name.toLowerCase().replace(/\s+/g, ' ')

      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          fullName: name,
          episodeCount: 1,
          latestDate: episode.startDate,
          latestTitle: episode.title,
          episodeIds: [episode.id],
        })
        continue
      }

      existing.episodeCount += 1
      existing.episodeIds.push(episode.id)
      if (episode.startDate > existing.latestDate) {
        existing.latestDate = episode.startDate
        existing.latestTitle = episode.title
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}

/**
 * Turn a past guest into a person record for the `network` component.
 *
 * Two decisions worth noting. The appearance is recorded as a real
 * `podcast_appearances` entry, because "has appeared on a podcast" is the single
 * most predictive field in the model and a past guest is the strongest possible
 * case of it. And the source is attributed to the platform's own episode record,
 * which satisfies the §16 rule that every field carries a provenance — here the
 * provenance is simply "we were there".
 */
export function guestToPersonInput(guest: ImportableGuest, showName = 'Inspire2Live podcast'): PersonInput {
  return {
    fullName: guest.fullName,
    origin: 'past_guest',
    whatTheyCanSay: `Appeared on ${showName}: “${guest.latestTitle}”.`,
    appearances: [
      {
        show: showName,
        url: null,
        publishedAt: guest.latestDate,
      },
    ],
    sourceAttribution: {
      podcast_appearances: `internal:events/${guest.episodeIds[0]}`,
      origin: 'internal:podcast-guest-roster',
    },
    notes:
      guest.episodeCount > 1
        ? `${guest.episodeCount} episodes, most recently “${guest.latestTitle}” (${guest.latestDate}).`
        : null,
  }
}
