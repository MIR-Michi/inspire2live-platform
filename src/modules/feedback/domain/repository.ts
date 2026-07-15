/**
 * feedback/domain/repository.ts — reads for the feedback surface.
 *
 * Reads run through the service-role admin client (feedback is admin-only), so
 * the callers (admin page, export route) share one query path instead of each
 * hand-rolling it.
 */

import type { User } from '@supabase/supabase-js'
import { isPlatformAdmin } from '@/lib/role-access'
import { createClient } from '@/kernel/data/server'
import { createAdminClient } from '@/kernel/data/admin'
import type { FeedbackItem, FeedbackStatus } from '@/modules/feedback/domain/types'

export type FeedbackAdminGate =
  | { user: User; reason: null }
  | { user: null; reason: 'unauthenticated' | 'forbidden' }

/**
 * Admin gate for the feedback surface. Returns the reason on failure so each
 * caller can choose its own response (page → redirect, route → HTTP status).
 */
export async function requireFeedbackAdmin(): Promise<FeedbackAdminGate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, reason: 'unauthenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) return { user: null, reason: 'forbidden' }
  return { user, reason: null }
}

/** Load feedback items, newest first, filtered by ids (preferred) or status. */
export async function loadFeedbackItems(
  opts: { status?: string; ids?: string[] } = {},
): Promise<FeedbackItem[]> {
  const db = createAdminClient()
  let query = db.from('feedback_items').select('*').order('created_at', { ascending: false })

  if (opts.ids && opts.ids.length > 0) {
    query = query.in('id', opts.ids)
  } else if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status as FeedbackStatus)
  }

  const { data } = await query
  return (data ?? []) as unknown as FeedbackItem[]
}

export type FeedbackStatusCounts = { open: number; reviewed: number; resolved: number; all: number }

/** Count items per status for the admin filter tabs. */
export async function loadFeedbackStatusCounts(): Promise<FeedbackStatusCounts> {
  const db = createAdminClient()
  const { data: counts } = await db.from('feedback_items').select('status')
  const c: FeedbackStatusCounts = { open: 0, reviewed: 0, resolved: 0, all: 0 }
  for (const row of (counts ?? []) as { status: string }[]) {
    c.all++
    if (row.status === 'open' || row.status === 'reviewed' || row.status === 'resolved') {
      c[row.status]++
    }
  }
  return c
}
