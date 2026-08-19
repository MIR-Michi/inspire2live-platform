/**
 * content/domain/calendar-entries.ts — the calendar owner's own create action.
 *
 * Other components never insert into `content_calendar` directly (ADR-0009 §9
 * rule 3): an approved publishing draft, a booked podcast recording — anything
 * that becomes a calendar item — goes through this function so the calendar
 * keeps one owner and one lifecycle.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type AppSupabaseClient = SupabaseClient<Database>

export type CreateCalendarEntryInput = {
  title: string
  /** Content channel vocabulary (`CalendarChannel` values). */
  channels: string[]
  /** Entries start in the calendar's own lifecycle; defaults to 'draft'. */
  status?: 'draft' | 'in_review' | 'scheduled'
  scheduledAt?: string | null
  bodyDraft?: string | null
  sourceLink?: string | null
  tags?: string[]
  authorId: string
}

export type CreateCalendarEntryResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function createCalendarEntry(
  supabase: AppSupabaseClient,
  input: CreateCalendarEntryInput,
): Promise<CreateCalendarEntryResult> {
  const title = input.title.trim()
  if (!title) return { ok: false, error: 'A calendar entry needs a title.' }
  if (input.channels.length === 0) return { ok: false, error: 'A calendar entry needs at least one channel.' }

  const { data, error } = await supabase
    .from('content_calendar')
    .insert({
      title,
      channels: input.channels,
      status: input.status ?? 'draft',
      scheduled_at: input.scheduledAt ?? null,
      body_draft: input.bodyDraft ?? null,
      source_link: input.sourceLink ?? null,
      tags: input.tags ?? [],
      author_id: input.authorId,
    })
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'The calendar entry was not created.' }
  return { ok: true, id: data.id }
}
