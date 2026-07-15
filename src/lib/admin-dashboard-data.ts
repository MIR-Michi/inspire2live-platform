/**
 * lib/admin-dashboard-data.ts
 *
 * Server-side data loading for the **admin dashboard** (PlatformAdmin variant of
 * the shared dashboard). Deliberately lean: it produces at-a-glance signal —
 * KPIs, a triage list, and a few top rows per card — not full management tables.
 * Every widget deep-links into the admin pages where the actual work happens, so
 * the dashboard never duplicates a management surface.
 *
 * Each query is guarded independently: a failing widget degrades to a safe
 * default (0 / empty) instead of crashing the whole dashboard — the same
 * best-effort posture the comms dashboard uses for its non-critical widgets.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTasksForUser } from '@/lib/tasks/repository'
import type { UnifiedTask } from '@/lib/tasks/types'

const DAY_MS = 86_400_000
const sevenDaysAgo = () => new Date(Date.now() - 7 * DAY_MS).toISOString()

export type AttentionTone = 'red' | 'amber' | 'neutral'

export type AttentionItem = {
  id: string
  label: string
  count: number
  href: string
  tone: AttentionTone
}

export type AdminKpis = {
  totalUsers: number
  activeUsers: number
  weeklyActiveUsers: number
  onboardingPending: number
  openFeedback: number
  aiSpend7d: number
  aiErrors7d: number
}

export type RoleCount = { role: string; count: number }

export type RecentSignup = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

export type RecentActivity = {
  id: string
  name: string
  kind: string
  space: string
  occurredAt: string
}

export type AdminSystemHealth = {
  aiConfigured: boolean
  emailFailures7d: number
  permissionOverrides: number
}

export type AdminDashboardData = {
  kpis: AdminKpis
  attention: AttentionItem[]
  roleDistribution: RoleCount[]
  recentSignups: RecentSignup[]
  recentActivity: RecentActivity[]
  system: AdminSystemHealth
  /** The admin's own open tasks across sources (empty when no userId given). */
  myTasks: UnifiedTask[]
}

/**
 * Build the needs-attention triage list from resolved signals. Pure (no DB) so
 * the triage rules and ordering can be unit-tested directly. Only genuinely
 * actionable items surface; the list is sorted red → amber → neutral.
 */
export function deriveAttention(input: {
  onboardingPending: number
  openFeedback: number
  emailFailures7d: number
  aiErrors7d: number
  aiConfigured: boolean
}): AttentionItem[] {
  const items: AttentionItem[] = []
  if (input.onboardingPending > 0)
    items.push({ id: 'onboarding', label: 'users have not completed onboarding', count: input.onboardingPending, href: '/app/admin/users', tone: 'amber' })
  if (input.openFeedback > 0)
    items.push({ id: 'feedback', label: 'open feedback items awaiting response', count: input.openFeedback, href: '/app/admin/feedback', tone: 'amber' })
  if (input.emailFailures7d > 0)
    items.push({ id: 'email', label: 'failed emails in the last 7 days', count: input.emailFailures7d, href: '/app/admin/activity', tone: 'red' })
  if (input.aiErrors7d > 0)
    items.push({ id: 'ai-errors', label: 'AI errors in the last 7 days', count: input.aiErrors7d, href: '/app/admin/ai', tone: 'red' })
  if (!input.aiConfigured)
    items.push({ id: 'ai-config', label: 'AI credential is not configured', count: 1, href: '/app/admin/ai', tone: 'neutral' })

  const rank: Record<AttentionTone, number> = { red: 0, amber: 1, neutral: 2 }
  return items.sort((a, b) => rank[a.tone] - rank[b.tone])
}

/** Run a loader, returning `fallback` if it throws or the query errors. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export async function loadAdminDashboardData(
  supabase: SupabaseClient,
  userId?: string,
): Promise<AdminDashboardData> {
  const since = sevenDaysAgo()

  // ── The admin's own open tasks (across sources) ──
  const myTasks = userId
    ? await safe(() => loadTasksForUser(supabase, userId, { openOnly: true }), [] as UnifiedTask[])
    : []

  // ── Profiles: the base for several KPIs + the activity name map ──
  const profiles = await safe(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, status, onboarding_completed, created_at')
      .order('created_at', { ascending: false })
    return data ?? []
  }, [] as Array<{
    id: string; name: string | null; email: string | null; role: string | null
    status: string | null; onboarding_completed: boolean | null; created_at: string
  }>)

  const nameById = new Map(profiles.map((p) => [p.id, p.name ?? p.email ?? 'Unknown']))
  const totalUsers = profiles.length
  const activeUsers = profiles.filter((p) => p.status !== 'inactive').length
  const onboardingPending = profiles.filter((p) => p.onboarding_completed === false).length

  const roleDistribution: RoleCount[] = Object.entries(
    profiles.reduce<Record<string, number>>((acc, p) => {
      const r = p.role ?? 'PatientAdvocate'
      acc[r] = (acc[r] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)

  const recentSignups: RecentSignup[] = profiles.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name ?? 'Unnamed',
    email: p.email ?? '',
    role: p.role ?? 'PatientAdvocate',
    createdAt: p.created_at,
  }))

  // ── Weekly active users + recent activity (admin-select RLS) ──
  const weeklyActiveUsers = await safe(async () => {
    const { data } = await supabase
      .from('user_activity_events')
      .select('user_id')
      .gte('occurred_at', since)
    return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id)).size
  }, 0)

  const recentActivity = await safe(async () => {
    const { data } = await supabase
      .from('user_activity_events')
      .select('id, user_id, kind, space, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(8)
    return (data ?? []).map((r) => {
      const row = r as { id: string; user_id: string; kind: string; space: string; occurred_at: string }
      return {
        id: row.id,
        name: nameById.get(row.user_id) ?? 'Unknown',
        kind: row.kind,
        space: row.space,
        occurredAt: row.occurred_at,
      }
    })
  }, [] as RecentActivity[])

  // ── Open feedback ──
  const openFeedback = await safe(async () => {
    const { count } = await supabase
      .from('feedback_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    return count ?? 0
  }, 0)

  // ── AI usage (7d) ──
  const ai = await safe(async () => {
    const { data } = await supabase
      .from('ai_usage_log')
      .select('estimated_cost_usd, success, created_at')
      .gte('created_at', since)
    const rows = (data ?? []) as Array<{ estimated_cost_usd: number | null; success: boolean }>
    const spend = rows.reduce((s, r) => s + (Number(r.estimated_cost_usd) || 0), 0)
    const errors = rows.filter((r) => r.success === false).length
    return { spend, errors }
  }, { spend: 0, errors: 0 })

  const aiConfigured = await safe(async () => {
    const { data } = await supabase
      .from('ai_settings')
      .select('api_key_last4')
      .eq('singleton', true)
      .maybeSingle()
    return Boolean((data as { api_key_last4: string | null } | null)?.api_key_last4)
  }, false)

  // ── Email failures (7d) ──
  const emailFailures7d = await safe(async () => {
    const { count } = await supabase
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since)
    return count ?? 0
  }, 0)

  // ── Permission overrides ──
  const permissionOverrides = await safe(async () => {
    const { count } = await supabase
      .from('user_space_permissions')
      .select('id', { count: 'exact', head: true })
    return count ?? 0
  }, 0)

  // ── Needs-attention triage list (only surfaces real, actionable items) ──
  const attention = deriveAttention({
    onboardingPending,
    openFeedback,
    emailFailures7d,
    aiErrors7d: ai.errors,
    aiConfigured,
  })

  return {
    kpis: {
      totalUsers,
      activeUsers,
      weeklyActiveUsers,
      onboardingPending,
      openFeedback,
      aiSpend7d: ai.spend,
      aiErrors7d: ai.errors,
    },
    attention,
    roleDistribution,
    recentSignups,
    recentActivity,
    system: {
      aiConfigured,
      emailFailures7d,
      permissionOverrides,
    },
    myTasks,
  }
}
