/**
 * events/domain/publishing-sources.ts — the World Campus session as a
 * publishable source (ADR-0014 §2).
 *
 * The curation IS the privacy decision: only fields whose *purpose* is
 * publication leave this component. The raw transcript, the WhatsApp digest,
 * task assignments, attendee lists and internal comments are aggregated on the
 * same campus page — and none of them are in this payload, so none of them can
 * ever reach a model or a draft. The presenter is the only named person, with
 * consent 'public' (their profile link is already public).
 *
 * `events` exports this provider shaped by the kernel contract and knows
 * nothing about `publishing`; the two meet in `src/modules/publishing-registry.ts`.
 */

import {
  fingerprintSource,
  type PublishableField,
  type PublishablePerson,
  type PublishableSource,
  type SourceCandidate,
  type SourceContext,
  type SourceProvider,
} from '@/kernel/publishing'
import { loadCampusSessionPublicationBlurb } from '@/modules/events/domain/comms-meeting-transcripts'

export const CAMPUS_SESSION_SOURCE_TYPE = 'campus_session'

type CampusSessionRow = {
  id: string
  session_date: string
  theme: string | null
  summary: string | null
  decisions_for_publication: string[] | null
  action_items_for_publication: string[] | null
  participating_hub_ids: string[] | null
  published_outputs: string[] | null
  presenter_name: string | null
  presenter_linkedin_url: string | null
}

const SESSION_SELECT =
  'id, session_date, theme, summary, decisions_for_publication, action_items_for_publication, participating_hub_ids, published_outputs, presenter_name, presenter_linkedin_url'

type LooseCampusQuery = {
  select: (columns: string) => {
    order: (column: string, opts: { ascending: boolean }) => {
      limit: (n: number) => Promise<{ data: CampusSessionRow[] | null; error: { message: string } | null }>
    }
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: CampusSessionRow | null; error: { message: string } | null }>
    }
  }
  update: (payload: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
  }
}

// The generated database types predate the presenter columns (00105), so the
// campus queries here use a narrow structural type instead of `(supabase as any)`.
function campusSessions(ctx: SourceContext): LooseCampusQuery {
  return (ctx.supabase as unknown as { from: (table: string) => LooseCampusQuery }).from('campus_sessions')
}

function pushField(fields: PublishableField[], field: PublishableField) {
  if (field.value.trim().length > 0) fields.push(field)
}

async function hubNames(ctx: SourceContext, hubIds: string[]): Promise<string[]> {
  if (hubIds.length === 0) return []
  const db = ctx.supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => Promise<{ data: Array<{ name: string }> | null }>
      }
    }
  }
  const { data } = await db.from('hubs').select('name').in('id', hubIds)
  return (data ?? []).map((hub) => hub.name).filter(Boolean)
}

/** Everything the drafter may know about one campus session — and nothing else. */
async function loadCampusSessionSource(
  ctx: SourceContext,
  sourceId: string,
): Promise<PublishableSource | null> {
  const { data: session, error } = await campusSessions(ctx).select(SESSION_SELECT).eq('id', sourceId).maybeSingle()
  if (error) {
    console.error('[events] campus publishing source load failed', error.message)
    return null
  }
  if (!session) return null

  const fields: PublishableField[] = []
  pushField(fields, { key: 'theme', label: 'Theme', value: session.theme ?? '', intent: 'fact' })
  pushField(fields, { key: 'summary', label: 'Session summary', value: session.summary ?? '', intent: 'copy' })
  pushField(fields, {
    key: 'decisions_for_publication',
    label: 'Decisions for publication',
    value: (session.decisions_for_publication ?? []).join('\n'),
    intent: 'copy',
  })
  pushField(fields, {
    key: 'action_items_for_publication',
    label: 'Action items for publication',
    value: (session.action_items_for_publication ?? []).join('\n'),
    intent: 'copy',
  })

  // The AI meeting summary's publication blurb is already publication-oriented
  // material; the rest of the summary (internal decisions/actions) stays out.
  // The narrow loader never selects `extracted_text`, so the raw transcript is
  // not even read into this render — the curation holds at the query, not just
  // at the payload.
  try {
    const publicationBlurb = await loadCampusSessionPublicationBlurb(ctx.supabase, session.id)
    pushField(fields, {
      key: 'publication_blurb',
      label: 'Publication blurb',
      value: publicationBlurb ?? '',
      intent: 'copy',
    })
  } catch {
    // The blurb is an enhancement — a transcript failure never blocks the source.
  }

  const hubs = await hubNames(ctx, session.participating_hub_ids ?? [])
  pushField(fields, {
    key: 'participating_hubs',
    label: 'Participating hubs',
    value: hubs.join(', '),
    intent: 'fact',
  })

  const people: PublishablePerson[] = session.presenter_name
    ? [{ name: session.presenter_name, role: 'Presenter', consent: 'public' }]
    : []

  const links =
    session.presenter_name && session.presenter_linkedin_url
      ? [{ label: `${session.presenter_name} on LinkedIn`, url: session.presenter_linkedin_url }]
      : []

  const base = {
    sourceType: CAMPUS_SESSION_SOURCE_TYPE,
    sourceId: session.id,
    title: session.theme || `World Campus session ${session.session_date}`,
    occurredAt: session.session_date,
    reviewHref: `/app/comms/campus-log/sessions/${session.id}`,
    publicUrl: null,
    fields,
    images: [],
    people,
    links,
    rights: null,
  }
  return { ...base, fingerprint: fingerprintSource(base) }
}

export const campusSessionSourceProvider: SourceProvider = {
  sourceType: CAMPUS_SESSION_SOURCE_TYPE,
  label: 'World Campus session',
  ownedBy: 'events',

  async listRecent(ctx: SourceContext, limit: number): Promise<SourceCandidate[]> {
    const { data, error } = await campusSessions(ctx)
      .select(SESSION_SELECT)
      .order('session_date', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('[events] campus publishing candidates failed', error.message)
      return []
    }
    return (data ?? []).map((session) => ({
      sourceType: CAMPUS_SESSION_SOURCE_TYPE,
      sourceId: session.id,
      label: session.theme || 'Campus session',
      occurredAt: session.session_date,
      hint: 'World Campus',
    }))
  },

  load: loadCampusSessionSource,

  /** Provenance write-back stays inside the owning component (ADR-0014 §6). */
  async onPublished(ctx: SourceContext, sourceId: string, calendarEntryId: string): Promise<void> {
    const { data: session, error } = await campusSessions(ctx)
      .select('id, session_date, published_outputs')
      .eq('id', sourceId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!session) throw new Error('Campus session not found.')

    const outputs = session.published_outputs ?? []
    if (outputs.includes(calendarEntryId)) return

    const { error: updateError } = await campusSessions(ctx).update({
      published_outputs: [...outputs, calendarEntryId],
    }).eq('id', sourceId)
    if (updateError) throw new Error(updateError.message)
  },
}
