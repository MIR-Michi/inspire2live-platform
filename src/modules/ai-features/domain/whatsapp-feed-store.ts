import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { WhatsAppFeedMessage } from './whatsapp-feed-categorization'
import { toDigestItem, toDigestSummary, type DigestBundle } from '@/lib/whatsapp-digest-types'

type AppSupabaseClient = SupabaseClient<Database>

// intake_items / campus_sessions read shapes used here aren't all in the
// generated Database types, so we narrow through a structural cast, mirroring
// the rest of the AI-features surfaces.
type LooseReadDb = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        opts: { ascending: boolean }
      ) => {
        limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      } & Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      not: (
        column: string,
        op: string,
        value: null
      ) => {
        gte: (
          column: string,
          value: string
        ) => {
          lt: (
            column: string,
            value: string
          ) => {
            order: (
              column: string,
              opts: { ascending: boolean }
            ) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> }
          }
        }
      }
    }
  }
}

export const MAX_FEED_WINDOW_MESSAGES = 1000

/**
 * Load inbound WhatsApp messages (intake_items with a WhatsApp sender) captured
 * within [startIso, endIso). This is the feed shown on the right column and the
 * input to categorization. Inbound-only for v1 — outbound is reply context, not
 * community content.
 */
export async function loadWhatsAppFeedWindow(
  supabase: AppSupabaseClient,
  window: { startIso: string; endIso: string }
): Promise<WhatsAppFeedMessage[]> {
  const db = supabase as unknown as LooseReadDb
  const { data, error } = await db
    .from('intake_items')
    .select('id, sender_name, raw_content, captured_at')
    .not('sender_whatsapp_id', 'is', null)
    .gte('captured_at', window.startIso)
    .lt('captured_at', window.endIso)
    .order('captured_at', { ascending: true })
    .limit(MAX_FEED_WINDOW_MESSAGES)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    senderName: typeof row.sender_name === 'string' ? row.sender_name : 'Unknown',
    text: typeof row.raw_content === 'string' ? row.raw_content : '',
    timestamp: typeof row.captured_at === 'string' ? row.captured_at : new Date().toISOString(),
  }))
}

// whatsapp_feed_summaries / whatsapp_feed_items reads for the shared digest.
type LooseDigestDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        in: (
          column: string,
          values: string[]
        ) => {
          order: (
            column: string,
            opts: { ascending: boolean }
          ) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> }
        }
        order: (
          column: string,
          opts: { ascending: boolean }
        ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      }
    }
  }
}

/**
 * Load the shared WhatsApp digest for a campus meeting: the most recent
 * pending-or-saved `whatsapp_feed_summaries` row linked to that session, plus its
 * items. Returns null when none has been generated. Campus reads through this —
 * it never runs the AI, so the digest is generated once (in the WhatsApp
 * workspace) and read in both places.
 */
export async function loadCampusDigest(supabase: AppSupabaseClient, campusSessionId: string): Promise<DigestBundle | null> {
  const db = supabase as unknown as LooseDigestDb

  const { data: summaryRows, error } = await db
    .from('whatsapp_feed_summaries')
    .select('id, window_start, window_end, monthly, tldr, monthly_summary, message_count, status, model, created_at')
    .eq('campus_session_id', campusSessionId)
    .in('status', ['pending', 'saved'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)

  const summaryRow = (summaryRows ?? [])[0]
  if (!summaryRow) return null

  const { data: itemRows } = await db
    .from('whatsapp_feed_items')
    .select('id, category, title, person, item_date, detail, source_message_ids, proposal_status, linked_type')
    .eq('summary_id', String(summaryRow.id))
    .order('created_at', { ascending: true })

  return {
    summary: toDigestSummary(summaryRow),
    items: (itemRows ?? []).map(toDigestItem),
  }
}

/** Load campus session dates (most recent first) for default window derivation. */
export async function loadCampusSessionDates(supabase: AppSupabaseClient, limit = 12): Promise<string[]> {
  const db = supabase as unknown as LooseReadDb
  const { data, error } = await db
    .from('campus_sessions')
    .select('session_date')
    .order('session_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => (typeof row.session_date === 'string' ? row.session_date : ''))
    .filter((d) => d.length > 0)
}
