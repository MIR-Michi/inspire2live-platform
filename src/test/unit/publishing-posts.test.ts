/**
 * Domain tests for the saved post (ADR-0015).
 *
 * Two things are worth pinning down here, because both are rules the UI must
 * never be the only holder of:
 *
 * 1. The status machine: which moves are legal, and that every *forward* move
 *    goes through the rights gate — not just handover, as it was when the gate
 *    only guarded the calendar.
 * 2. Handover reads the post's current text. The whole reason handover moved
 *    off the draft is that the post keeps changing after approval; a test that
 *    edits the post and then hands over is the one that would have caught the
 *    stale-copy bug.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishingPost } from '@/modules/publishing/domain/types'

// ─── pure guards (no database) ────────────────────────────────────────────────

import {
  canTransitionPost,
  nextPostStatuses,
  postDisplayTitle,
  postTransitionBlockReason,
} from '@/modules/publishing/domain/post-status'

function post(overrides: Partial<PublishingPost> = {}): PublishingPost {
  return {
    id: 'post-1',
    title: null,
    sourceType: 'campus_session',
    sourceId: 'session-1',
    draftId: 'draft-1',
    channel: 'linkedin',
    body: 'A post that says something true.',
    hashtags: ['#PatientAdvocacy'],
    imageRef: null,
    status: 'draft',
    ownerId: 'user-1',
    createdBy: 'user-1',
    contentCalendarId: null,
    publishedAt: null,
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    ...overrides,
  }
}

describe('the post status machine', () => {
  it('walks draft → ready → published, and back again', () => {
    expect(nextPostStatuses('draft')).toEqual(['ready_to_publish'])
    expect(nextPostStatuses('ready_to_publish')).toEqual(['draft', 'published'])
    expect(nextPostStatuses('published')).toEqual(['ready_to_publish'])
  })

  it('refuses to skip the middle state', () => {
    expect(canTransitionPost('draft', 'published')).toBe(false)
    expect(postTransitionBlockReason(post(), 'published', null)).toMatch(/cannot move straight/i)
  })

  it('lets a post marked published by mistake be walked back', () => {
    expect(canTransitionPost('published', 'ready_to_publish')).toBe(true)
    expect(postTransitionBlockReason(post({ status: 'published' }), 'ready_to_publish', null)).toBeNull()
  })
})

describe('the rights gate covers the whole forward path, not just handover', () => {
  it('blocks marking uncleared material ready to publish', () => {
    expect(postTransitionBlockReason(post(), 'ready_to_publish', 'needs_clearance')).toMatch(/not cleared/i)
    expect(postTransitionBlockReason(post(), 'ready_to_publish', 'internal_only')).toMatch(/internal/i)
  })

  it('blocks marking uncleared material published', () => {
    const ready = post({ status: 'ready_to_publish' })
    expect(postTransitionBlockReason(ready, 'published', 'internal_only')).toMatch(/internal/i)
  })

  it('never blocks a move backwards — uncleared material can always be pulled back', () => {
    const ready = post({ status: 'ready_to_publish' })
    expect(postTransitionBlockReason(ready, 'draft', 'needs_clearance')).toBeNull()
  })

  it('allows cleared material and a linked source that carries no answer', () => {
    expect(postTransitionBlockReason(post(), 'ready_to_publish', 'approved_for_publication')).toBeNull()
    expect(postTransitionBlockReason(post(), 'ready_to_publish', null)).toBeNull()
  })

  it('refuses to call an empty post ready', () => {
    expect(postTransitionBlockReason(post({ body: '   ' }), 'ready_to_publish', null)).toMatch(/write the post/i)
  })
})

describe('postDisplayTitle — a tile always has something to show', () => {
  it('prefers the explicit title', () => {
    expect(postDisplayTitle({ title: 'Our stand at ESMO', body: 'Body' })).toBe('Our stand at ESMO')
  })

  it('falls back to the first non-empty line of the body', () => {
    expect(postDisplayTitle({ title: null, body: '\n\nWhat if your care…\nSecond line' })).toBe('What if your care…')
  })

  it('names an empty post rather than rendering a blank tile', () => {
    expect(postDisplayTitle({ title: null, body: '' })).toBe('Untitled post')
    expect(postDisplayTitle({ title: '   ', body: '   ' })).toBe('Untitled post')
  })
})

// ─── the writes (recorded Supabase calls) ─────────────────────────────────────

type RecordedCall = {
  op: 'update' | 'insert' | 'delete'
  table: string
  payload?: Record<string, unknown>
  filters: Record<string, unknown>
}

const recorded: RecordedCall[] = []

function chain(call: RecordedCall, result: unknown = { id: 'post-1' }) {
  const c = {
    eq(column: string, value: unknown) {
      call.filters[column] = value
      return c
    },
    is(column: string, value: unknown) {
      call.filters[column] = value
      return c
    },
    select() {
      return c
    },
    maybeSingle() {
      return Promise.resolve({ data: result, error: null })
    },
    then(resolve: (value: { error: null }) => void) {
      resolve({ error: null })
    },
  }
  return c
}

function fakeDb() {
  return {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          const call: RecordedCall = { op: 'update', table, payload, filters: {} }
          recorded.push(call)
          return chain(call)
        },
        delete() {
          const call: RecordedCall = { op: 'delete', table, filters: {} }
          recorded.push(call)
          return chain(call)
        },
      }
    },
  }
}

const loadPostMock = vi.fn()
const loadAdhocSourceRowMock = vi.fn()
const createCalendarEntryMock = vi.fn()
const logIntegrationIntentMock = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/kernel/data/server', () => ({
  createClient: vi.fn(async () => ({ storage: { from: () => ({ remove: vi.fn() }) } })),
}))
vi.mock('@/modules/publishing/domain/repository', () => ({
  publishingDb: vi.fn(async () => fakeDb()),
  loadDraft: vi.fn(),
  loadPost: (...args: unknown[]) => loadPostMock(...args),
  loadPostsForDrafts: vi.fn(async () => []),
  loadAdhocSourceRow: (...args: unknown[]) => loadAdhocSourceRowMock(...args),
}))
vi.mock('@/modules/content', () => ({
  createCalendarEntry: (...args: unknown[]) => createCalendarEntryMock(...args),
  logIntegrationIntent: (...args: unknown[]) => logIntegrationIntentMock(...args),
}))

import { handOverPost, setPostStatus } from '@/modules/publishing/domain/posts'

beforeEach(() => {
  recorded.length = 0
  vi.clearAllMocks()
  createCalendarEntryMock.mockResolvedValue({ ok: true, id: 'cal-1' })
  logIntegrationIntentMock.mockResolvedValue(undefined)
})

describe('setPostStatus', () => {
  it('stamps published_at when a human says it went out', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'ready_to_publish' }))
    const result = await setPostStatus({ postId: 'post-1', status: 'published' })
    expect(result.ok).toBe(true)

    const update = recorded.find((call) => call.op === 'update')
    expect(update?.payload?.status).toBe('published')
    expect(update?.payload?.published_at).toBeTruthy()
    // Optimistic lock: the move only lands from the status we read.
    expect(update?.filters).toMatchObject({ id: 'post-1', status: 'ready_to_publish' })
  })

  it('clears published_at when the post is walked back', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'published', publishedAt: '2026-08-19T00:00:00Z' }))
    await setPostStatus({ postId: 'post-1', status: 'ready_to_publish' })
    expect(recorded[0]?.payload?.published_at).toBeNull()
  })

  it('writes nothing when the rights are not cleared', async () => {
    loadPostMock.mockResolvedValue(post({ sourceType: 'adhoc', sourceId: 'src-1' }))
    loadAdhocSourceRowMock.mockResolvedValue({ id: 'src-1', rights_status: 'needs_clearance' })

    const result = await setPostStatus({ postId: 'post-1', status: 'ready_to_publish' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not cleared/i)
    expect(recorded).toHaveLength(0)
  })
})

describe('handOverPost — the calendar gets the post, not the frozen draft', () => {
  it('sends the post’s current text, edits and all', async () => {
    loadPostMock.mockResolvedValue(
      post({
        status: 'ready_to_publish',
        body: 'The edited version a human actually wants published.',
        hashtags: ['#WorldCampus'],
        title: 'Virtual Human Twin',
      }),
    )

    const result = await handOverPost({ postId: 'post-1', userId: 'user-9' })
    expect(result.ok).toBe(true)

    expect(createCalendarEntryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Virtual Human Twin',
        channels: ['linkedin'],
        status: 'draft',
        bodyDraft: 'The edited version a human actually wants published.\n\n#WorldCampus',
        // The calendar entry belongs to whoever owns the post, not whoever clicked.
        authorId: 'user-1',
      }),
    )
  })

  it('refuses a post still in draft', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'draft' }))
    const result = await handOverPost({ postId: 'post-1', userId: 'user-9' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/ready to publish/i)
    expect(createCalendarEntryMock).not.toHaveBeenCalled()
  })

  it('refuses uncleared material even once it is marked ready', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'ready_to_publish', sourceType: 'adhoc', sourceId: 'src-1' }))
    loadAdhocSourceRowMock.mockResolvedValue({ id: 'src-1', rights_status: 'internal_only' })

    const result = await handOverPost({ postId: 'post-1', userId: 'user-9' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/internal/i)
    expect(createCalendarEntryMock).not.toHaveBeenCalled()
  })

  it('refuses to put the same post on the calendar twice', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'published', contentCalendarId: 'cal-1' }))
    const result = await handOverPost({ postId: 'post-1', userId: 'user-9' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/already/i)
    expect(createCalendarEntryMock).not.toHaveBeenCalled()
  })

  it('logs the delivery intent against the post and runs the provenance hook', async () => {
    loadPostMock.mockResolvedValue(post({ status: 'ready_to_publish' }))
    const onPublished = vi.fn().mockResolvedValue(undefined)

    const result = await handOverPost({ postId: 'post-1', userId: 'user-9', onPublished })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data?.contentCalendarId).toBe('cal-1')

    const link = recorded.find((call) => call.op === 'update')
    expect(link?.payload).toMatchObject({ content_calendar_id: 'cal-1' })
    expect(link?.filters).toMatchObject({ id: 'post-1', content_calendar_id: null })

    expect(logIntegrationIntentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ target: 'linkedin', entityType: 'publishing_posts', entityId: 'post-1' }),
    )
    expect(onPublished).toHaveBeenCalledWith('cal-1')
  })
})
