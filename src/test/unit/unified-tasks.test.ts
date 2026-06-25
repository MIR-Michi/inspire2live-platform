/**
 * Unified task domain layer — unit tests (ADR-0008)
 *
 * Covers the canonical status normalization and the repository's mapping of
 * `unified_tasks` view rows into `UnifiedTask`s (owner + context resolution,
 * editability, open-only filtering, and ordering).
 */
import { describe, it, expect, vi } from 'vitest'
import { normalizeUnifiedTaskStatus, isTaskOpen } from '@/lib/tasks/status'
import { loadTasksForUser } from '@/lib/tasks/repository'

// ─── status normalization ────────────────────────────────────────────────────

describe('normalizeUnifiedTaskStatus', () => {
  it('passes comms/onboarding statuses through, defaulting unknowns', () => {
    expect(normalizeUnifiedTaskStatus('comms', 'in_progress')).toBe('in_progress')
    expect(normalizeUnifiedTaskStatus('onboarding', 'completed')).toBe('completed')
    expect(normalizeUnifiedTaskStatus('comms', 'skipped')).toBe('skipped')
    expect(normalizeUnifiedTaskStatus('comms', 'weird')).toBe('not_started')
    expect(normalizeUnifiedTaskStatus('onboarding', null)).toBe('not_started')
  })

  it('folds the initiative workflow into the canonical set', () => {
    expect(normalizeUnifiedTaskStatus('initiative', 'todo')).toBe('not_started')
    expect(normalizeUnifiedTaskStatus('initiative', 'review')).toBe('in_progress')
    expect(normalizeUnifiedTaskStatus('initiative', 'blocked')).toBe('in_progress')
    expect(normalizeUnifiedTaskStatus('initiative', 'done')).toBe('completed')
    expect(normalizeUnifiedTaskStatus('initiative', 'cancelled')).toBe('skipped')
  })
})

describe('isTaskOpen', () => {
  it('treats completed and skipped as closed', () => {
    expect(isTaskOpen('not_started')).toBe(true)
    expect(isTaskOpen('in_progress')).toBe(true)
    expect(isTaskOpen('completed')).toBe(false)
    expect(isTaskOpen('skipped')).toBe(false)
  })
})

// ─── repository ──────────────────────────────────────────────────────────────

function queryBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : null, error: null })
  )
  builder.then = (onFulfilled: (value: { data: unknown; error: null }) => unknown) =>
    Promise.resolve({ data, error: null }).then(onFulfilled)
  return builder
}

function buildSupabase(tables: Record<string, unknown[]>) {
  return { from: vi.fn((table: string) => queryBuilder(tables[table] ?? [])) }
}

const row = (over: Record<string, unknown>) => ({
  description: null,
  due_date: null,
  priority: null,
  position: null,
  context_id: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...over,
})

describe('loadTasksForUser', () => {
  it('maps sources, resolves context labels/links, and marks editability', async () => {
    const supabase = buildSupabase({
      unified_tasks: [
        row({ source: 'comms', id: 'c1', title: 'Comms task', owner_id: 'u1', status: 'in_progress', context_kind: 'standalone' }),
        row({ source: 'onboarding', id: 'o1', title: 'Create email', owner_id: 'u1', status: 'not_started', context_kind: 'onboarding_member', context_id: 'm1' }),
        row({ source: 'initiative', id: 'i1', title: 'Project task', owner_id: 'u1', status: 'todo', context_kind: 'initiative', context_id: 'init1' }),
      ],
      profiles: [{ id: 'u1', name: 'Ana', email: 'ana@x.com' }],
      member_onboarding: [{ id: 'm1', full_name: 'Jane Doe' }],
      initiatives: [{ id: 'init1', title: 'Cancer Initiative' }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = await loadTasksForUser(supabase as any, 'u1')

    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))

    expect(byId.c1).toMatchObject({ source: 'comms', editable: true, ownerLabel: 'Ana', context: { kind: 'standalone' } })
    expect(byId.o1).toMatchObject({
      source: 'onboarding',
      editable: true,
      context: { kind: 'onboarding_member', label: 'Jane Doe', href: '/app/comms/dashboard?view=team' },
    })
    expect(byId.i1).toMatchObject({
      source: 'initiative',
      editable: false,
      status: 'not_started', // 'todo' folded to canonical
      context: { kind: 'initiative', label: 'Cancer Initiative', href: '/app/initiatives/init1/tasks' },
    })
  })

  it('openOnly filters out completed/skipped tasks', async () => {
    const supabase = buildSupabase({
      unified_tasks: [
        row({ source: 'comms', id: 'c1', title: 'Open', owner_id: 'u1', status: 'in_progress', context_kind: 'standalone' }),
        row({ source: 'comms', id: 'c2', title: 'Done', owner_id: 'u1', status: 'completed', context_kind: 'standalone' }),
      ],
      profiles: [{ id: 'u1', name: 'Ana', email: 'ana@x.com' }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = await loadTasksForUser(supabase as any, 'u1', { openOnly: true })

    expect(tasks.map((t) => t.id)).toEqual(['c1'])
  })

  it('orders dated tasks (earliest) before undated ones', async () => {
    const supabase = buildSupabase({
      unified_tasks: [
        row({ source: 'comms', id: 'late', title: 'Late', owner_id: 'u1', status: 'not_started', due_date: '2026-07-01', context_kind: 'standalone' }),
        row({ source: 'comms', id: 'undated', title: 'Undated', owner_id: 'u1', status: 'not_started', context_kind: 'standalone' }),
        row({ source: 'comms', id: 'early', title: 'Early', owner_id: 'u1', status: 'not_started', due_date: '2026-06-15', context_kind: 'standalone' }),
      ],
      profiles: [{ id: 'u1', name: 'Ana', email: 'ana@x.com' }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = await loadTasksForUser(supabase as any, 'u1')

    expect(tasks.map((t) => t.id)).toEqual(['early', 'late', 'undated'])
  })
})
