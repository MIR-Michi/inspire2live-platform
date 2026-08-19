/**
 * kernel/publishing/types.ts
 *
 * The source/channel contracts for the Publishing space (ADR-0014). Kernel
 * because no component owns them (ADR-0009 §7): the `publishing` component
 * consumes a `PublishableSource`, and any component that can be published from
 * exports a `SourceProvider` shaped by these types. Composition happens in
 * `src/modules/publishing-registry.ts` — the kernel holds only the vocabulary
 * and pure helpers, never a provider, a channel or a model call.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** One piece of source material, classified by how the drafter may use it. */
export type PublishableField = {
  /** Stable key — draft claims cite this ('summary', 'decisions_for_publication', …). */
  key: string
  /** Shown in review as provenance. */
  label: string
  value: string
  /** 'copy' = prose it may paraphrase. 'fact' = a short value it may state, never embellish. */
  intent: 'copy' | 'fact'
}

/** An image the drafter may look at (and the post may carry). */
export type PublishableImage = {
  /** Private storage bucket the image lives in; read via signed URL / server-side download. */
  bucket: string
  storagePath: string
  mediaType: string // 'image/png' | 'image/jpeg' | 'image/webp'
  alt: string
}

/** A named person the draft may mention. Everyone else is a role or omitted. */
export type PublishablePerson = {
  name: string
  role?: string
  /** 'public' = a role already public (e.g. presenter with a public profile). 'granted' = recorded consent. */
  consent: 'public' | 'granted'
}

/** The rights answer on ad-hoc material (reuses the media-library vocabulary). */
export type SourceRightsStatus = 'internal_only' | 'approved_for_publication' | 'needs_clearance'

/** Everything the drafter is allowed to know about one thing. Curated by its owner. */
export type PublishableSource = {
  sourceType: string // 'campus_session' | 'adhoc' | …
  sourceId: string
  title: string
  occurredAt: string | null
  /** Where a human can verify the source. */
  reviewHref: string
  /** What the post may link to, when one exists. */
  publicUrl?: string | null
  fields: PublishableField[]
  images?: PublishableImage[]
  people?: PublishablePerson[]
  links?: Array<{ label: string; url: string }>
  /**
   * The rights answer captured on ad-hoc material. Absent/null for linked
   * sources — their owner already curates publication-intended fields only.
   * Anything other than 'approved_for_publication' can be drafted from but
   * never handed over (the gate lives in `publishing`'s domain layer).
   */
  rights?: SourceRightsStatus | null
  /** Hash over the payload — the staleness signal for linked sources. */
  fingerprint: string
}

/** One entry in the source picker, offered by a provider's `listRecent`. */
export type SourceCandidate = {
  sourceType: string
  sourceId: string
  label: string
  occurredAt: string | null
  /** Short secondary line (e.g. the provider's own vocabulary for the record). */
  hint?: string | null
}

/** What a provider needs to read its own data. RLS applies — this is the caller's client. */
export type SourceContext = {
  supabase: SupabaseClient
}

/** The extension point: one provider per source type, owned by one component. */
export type SourceProvider = {
  sourceType: string
  /** 'World Campus session' · 'Screenshot & note' — shown on picker badges. */
  label: string
  /** Component id — reconciled against the owning manifest's `provides.sources`. */
  ownedBy: string
  /** Offer recent candidates for the picker; ad-hoc offers none. */
  listRecent?(ctx: SourceContext, limit: number): Promise<SourceCandidate[]>
  load(ctx: SourceContext, sourceId: string): Promise<PublishableSource | null>
  /** Optional: record provenance on the source record, through the owner's own write path. */
  onPublished?(ctx: SourceContext, sourceId: string, calendarEntryId: string): Promise<void>
}

export type DeliveryMeta = {
  channel: string
  draftId: string
  approvedBy: string
}

export type DeliveryResult = { ok: true; externalId?: string | null } | { ok: false; error: string }

/**
 * The delivery port. Sprint 21 ships only the manual path (copy out + calendar
 * handover); a real connector (e.g. LinkedIn's API) is its own component
 * implementing this port, and it delivers only text a human already approved.
 */
export type ChannelConnector = {
  /** The content channel vocabulary (`CalendarChannel`). */
  channel: string
  deliver(text: string, meta: DeliveryMeta): Promise<DeliveryResult>
}
