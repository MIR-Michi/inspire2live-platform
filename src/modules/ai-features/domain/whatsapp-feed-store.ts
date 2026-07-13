import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { WhatsAppFeedMessage } from './whatsapp-feed-categorization'

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
