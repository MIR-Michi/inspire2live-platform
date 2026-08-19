/**
 * publishing/domain/channels.ts — a channel is data, never a module (ADR-0014 §5).
 *
 * Channel profiles are keyed by the existing `CalendarChannel` vocabulary from
 * `content_calendar` — no second vocabulary. "Website article" is the existing
 * `wordpress` channel. LinkedIn is enabled in Sprint 21; newsletter and
 * wordpress are declared so the space can show the roadmap, and enabling them
 * later is a data change here, not new pipeline code.
 */

import type { CalendarChannel } from '@/lib/comms-workflow'

export type ChannelProfile = {
  channel: CalendarChannel
  label: string
  /** 'enabled' = drafting works. 'declared' = visible in the space, not yet available. */
  availability: 'enabled' | 'declared'
  /** Character budget the drafter writes toward and the character ring fills against. */
  characterBudget: number
  /** Composition conventions folded into the system prompt. */
  conventions: string[]
  /** At most this many links in the copy (LinkedIn punishes link-stuffing). */
  maxLinks: number
  markdownAllowed: boolean
}

export const CHANNEL_PROFILES: readonly ChannelProfile[] = [
  {
    channel: 'linkedin',
    label: 'LinkedIn',
    availability: 'enabled',
    characterBudget: 1300,
    conventions: [
      'Open with a hook in the first line — the feed truncates after roughly 200 characters.',
      'Short paragraphs (1–3 sentences) separated by blank lines.',
      'At most one link, placed near the end.',
      'No markdown syntax of any kind — LinkedIn renders it literally.',
    ],
    maxLinks: 1,
    markdownAllowed: false,
  },
  {
    channel: 'newsletter',
    label: 'Newsletter',
    availability: 'declared',
    characterBudget: 2600,
    conventions: ['A titled section for an email newsletter; informative rather than hook-driven.'],
    maxLinks: 3,
    markdownAllowed: false,
  },
  {
    channel: 'wordpress',
    label: 'Website',
    availability: 'declared',
    characterBudget: 6000,
    conventions: ['A long-form article with headings for the organisation website.'],
    maxLinks: 5,
    markdownAllowed: true,
  },
] as const

/** Look up a profile; null for channels the space does not compose for (podcast, youtube). */
export function channelProfile(channel: string): ChannelProfile | null {
  return CHANNEL_PROFILES.find((profile) => profile.channel === channel) ?? null
}

/** The character budget for a channel (0 when unknown — callers treat that as unusable). */
export function channelBudget(channel: string): number {
  return channelProfile(channel)?.characterBudget ?? 0
}

export function isChannelEnabled(channel: string): boolean {
  return channelProfile(channel)?.availability === 'enabled'
}
