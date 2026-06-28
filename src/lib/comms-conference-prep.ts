/**
 * lib/comms-conference-prep.ts
 *
 * Types + pure helpers for the conference "speaking" operating page. The
 * pipeline stage (intended → registered → ongoing → follow_up → archived)
 * stays the single progression concept — it drives the tabs, the badges,
 * and the operating page's stage stepper. This module models the work
 * product attached to each stage and the small amount of derived state the
 * stepper needs (per-stage progress, presentation gating).
 *
 * The grouping/section logic is shared with the unit tests; the React shell
 * only renders it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ConferenceStage } from '@/lib/comms-conferences'

export type ConferenceKeyPerson = {
  name: string
  org: string
  topic: string
  connected: boolean
}

export type ConferencePrep = {
  conferenceId: string
  hasPresentation: boolean | null
  presentationTitle: string | null
  abstract: string | null
  deckUrl: string | null
  assetUrls: string[]
  keyPeople: ConferenceKeyPerson[]
  commsOwnerId: string | null
  commsContributorId: string | null
  abstractSubmitted: boolean
  deckDrafted: boolean
  deckFinal: boolean
  photoUrls: string[]
  takeaways: string | null
  delivered: boolean
  outputReport: boolean
  outputLinkedin: boolean
  outputWebsite: boolean
  outputWhatsapp: boolean
  outputNewsletter: boolean
  followupNotes: string | null
  podcastIdea: boolean
  podcastEventId: string | null
  campusIdea: boolean
  campusSessionId: string | null
  updatedAt: string | null
}

/** Boolean prep fields that can be flipped one at a time from the UI. */
export const CONFERENCE_PREP_FLAGS = [
  'abstractSubmitted',
  'deckDrafted',
  'deckFinal',
  'delivered',
  'outputReport',
  'outputLinkedin',
  'outputWebsite',
  'outputWhatsapp',
  'outputNewsletter',
  'podcastIdea',
  'campusIdea',
] as const

export type ConferencePrepFlag = (typeof CONFERENCE_PREP_FLAGS)[number]

const PREP_FLAG_TO_COLUMN: Record<ConferencePrepFlag, string> = {
  abstractSubmitted: 'abstract_submitted',
  deckDrafted: 'deck_drafted',
  deckFinal: 'deck_final',
  delivered: 'delivered',
  outputReport: 'output_report',
  outputLinkedin: 'output_linkedin',
  outputWebsite: 'output_website',
  outputWhatsapp: 'output_whatsapp',
  outputNewsletter: 'output_newsletter',
  podcastIdea: 'podcast_idea',
  campusIdea: 'campus_idea',
}

export function isConferencePrepFlag(value: string): value is ConferencePrepFlag {
  return (CONFERENCE_PREP_FLAGS as readonly string[]).includes(value)
}

export function prepFlagColumn(flag: ConferencePrepFlag): string {
  return PREP_FLAG_TO_COLUMN[flag]
}

/**
 * The checklist items used to compute per-stage progress on the stepper.
 * `intended` and `archived` carry no checklist (0/0 → no count shown).
 */
export const STAGE_CHECKLISTS: Record<ConferenceStage, Array<{ field: ConferencePrepFlag; label: string }>> = {
  intended: [],
  registered: [
    { field: 'abstractSubmitted', label: 'Abstract submitted' },
    { field: 'deckDrafted', label: 'Deck drafted' },
    { field: 'deckFinal', label: 'Deck final' },
  ],
  ongoing: [{ field: 'delivered', label: 'Presentation delivered' }],
  follow_up: [
    { field: 'outputReport', label: 'Report drafted' },
    { field: 'outputLinkedin', label: 'LinkedIn post' },
    { field: 'outputWebsite', label: 'Website mention' },
    { field: 'outputWhatsapp', label: 'WhatsApp share' },
    { field: 'outputNewsletter', label: 'Newsletter mention' },
  ],
  archived: [],
}

/** An empty prep record for conferences that have no row yet. */
export function emptyConferencePrep(conferenceId: string): ConferencePrep {
  return {
    conferenceId,
    hasPresentation: null,
    presentationTitle: null,
    abstract: null,
    deckUrl: null,
    assetUrls: [],
    keyPeople: [],
    commsOwnerId: null,
    commsContributorId: null,
    abstractSubmitted: false,
    deckDrafted: false,
    deckFinal: false,
    photoUrls: [],
    takeaways: null,
    delivered: false,
    outputReport: false,
    outputLinkedin: false,
    outputWebsite: false,
    outputWhatsapp: false,
    outputNewsletter: false,
    followupNotes: null,
    podcastIdea: false,
    podcastEventId: null,
    campusIdea: false,
    campusSessionId: null,
    updatedAt: null,
  }
}

/** Coerce arbitrary jsonb into a clean key-people list. */
export function parseKeyPeople(value: unknown): ConferenceKeyPerson[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (!name) return []
    return [
      {
        name,
        org: typeof record.org === 'string' ? record.org.trim() : '',
        topic: typeof record.topic === 'string' ? record.topic.trim() : '',
        connected: Boolean(record.connected),
      },
    ]
  })
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []
}

/** Map a raw `conference_prep` row into the view model. */
export function rowToConferencePrep(row: Record<string, unknown>): ConferencePrep {
  return {
    conferenceId: String(row.conference_id),
    hasPresentation: typeof row.has_presentation === 'boolean' ? row.has_presentation : null,
    presentationTitle: (row.presentation_title as string | null) ?? null,
    abstract: (row.abstract as string | null) ?? null,
    deckUrl: (row.deck_url as string | null) ?? null,
    assetUrls: asStringArray(row.asset_urls),
    keyPeople: parseKeyPeople(row.key_people),
    commsOwnerId: (row.comms_owner_id as string | null) ?? null,
    commsContributorId: (row.comms_contributor_id as string | null) ?? null,
    abstractSubmitted: Boolean(row.abstract_submitted),
    deckDrafted: Boolean(row.deck_drafted),
    deckFinal: Boolean(row.deck_final),
    photoUrls: asStringArray(row.photo_urls),
    takeaways: (row.takeaways as string | null) ?? null,
    delivered: Boolean(row.delivered),
    outputReport: Boolean(row.output_report),
    outputLinkedin: Boolean(row.output_linkedin),
    outputWebsite: Boolean(row.output_website),
    outputWhatsapp: Boolean(row.output_whatsapp),
    outputNewsletter: Boolean(row.output_newsletter),
    followupNotes: (row.followup_notes as string | null) ?? null,
    podcastIdea: Boolean(row.podcast_idea),
    podcastEventId: (row.podcast_event_id as string | null) ?? null,
    campusIdea: Boolean(row.campus_idea),
    campusSessionId: (row.campus_session_id as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  }
}

const PREP_COLUMNS =
  'conference_id, has_presentation, presentation_title, abstract, deck_url, asset_urls, key_people, comms_owner_id, comms_contributor_id, abstract_submitted, deck_drafted, deck_final, photo_urls, takeaways, delivered, output_report, output_linkedin, output_website, output_whatsapp, output_newsletter, followup_notes, podcast_idea, podcast_event_id, campus_idea, campus_session_id, updated_at'

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
  }
}

/** Load the prep row for one conference (or an empty record if none yet). */
export async function loadConferencePrep(
  supabase: SupabaseClient<Database>,
  conferenceId: string
): Promise<ConferencePrep> {
  const db = supabase as unknown as LooseDb
  try {
    const { data } = await db.from('conference_prep').select(PREP_COLUMNS).eq('conference_id', conferenceId).maybeSingle()
    return data ? rowToConferencePrep(data) : emptyConferencePrep(conferenceId)
  } catch (error) {
    console.error('[conferences] loadConferencePrep failed', error)
    return emptyConferencePrep(conferenceId)
  }
}

// ── Derived state for the stage stepper (shared with unit tests) ─────────────

export type StageProgress = { done: number; total: number }

/** Completed/total checklist items for a stage given the prep record. */
export function stagePrepProgress(prep: ConferencePrep, stage: ConferenceStage): StageProgress {
  const items = STAGE_CHECKLISTS[stage]
  const done = items.filter((item) => Boolean(prep[item.field])).length
  return { done, total: items.length }
}

/**
 * Whether a stage section should render its presentation-specific blocks
 * (title, abstract, deck, photos). When the engagement is explicitly
 * "attending only" (has_presentation === false) those blocks stay hidden so
 * the page isn't cluttered with fields that don't apply.
 */
export function showsPresentationBlocks(prep: ConferencePrep): boolean {
  return prep.hasPresentation !== false
}
