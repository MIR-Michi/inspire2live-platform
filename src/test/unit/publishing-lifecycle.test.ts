/**
 * Domain tests for the draft lifecycle rules (S21-T20): approval stamps and
 * dismisses the run siblings, an approved draft can no longer be edited, and
 * regenerating supersedes the previous pending run before writing the new one.
 *
 * The Supabase module client is replaced with a call recorder so the rules
 * are asserted on the exact writes the domain issues.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishingDraft } from '@/modules/publishing/domain/types'

type RecordedCall = {
  op: 'update' | 'insert'
  table: string
  payload?: Record<string, unknown>
  rows?: Array<Record<string, unknown>>
  filters: Record<string, unknown>
  notEq?: [string, unknown]
}

const recorded: RecordedCall[] = []

function chain(call: RecordedCall) {
  const c = {
    eq(column: string, value: unknown) {
      call.filters[column] = value
      return c
    },
    neq(column: string, value: unknown) {
      call.notEq = [column, value]
      return c
    },
    select() {
      return c
    },
    maybeSingle() {
      return Promise.resolve({ data: { id: 'updated' }, error: null })
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
        insert(rows: Array<Record<string, unknown>>) {
          recorded.push({ op: 'insert', table, rows, filters: {} })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

const loadDraftMock = vi.fn()
const loadAdhocSourceRowMock = vi.fn()
const resolveConfigMock = vi.fn()
const createCalendarEntryMock = vi.fn()
const logIntegrationIntentMock = vi.fn()
const runAiMessageMock = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/kernel/data/server', () => ({
  createClient: vi.fn(async () => ({ storage: { from: () => ({}) } })),
}))
vi.mock('@/modules/publishing/domain/repository', () => ({
  publishingDb: vi.fn(async () => fakeDb()),
  loadDraft: (...args: unknown[]) => loadDraftMock(...args),
  loadAdhocSourceRow: (...args: unknown[]) => loadAdhocSourceRowMock(...args),
}))
vi.mock('@/modules/publishing/domain/config', () => ({
  resolvePublishingConfig: (...args: unknown[]) => resolveConfigMock(...args),
}))
vi.mock('@/modules/content', () => ({
  createCalendarEntry: (...args: unknown[]) => createCalendarEntryMock(...args),
  logIntegrationIntent: (...args: unknown[]) => logIntegrationIntentMock(...args),
}))
vi.mock('@/kernel/ai-client', () => ({
  runAiMessage: (...args: unknown[]) => runAiMessageMock(...args),
  wrapExternalData: (label: string, value: string) =>
    [`[external-data:${label}:start]`, value, `[external-data:${label}:end]`].join('\n'),
}))

import { approveDraft, dismissDraft, editDraft } from '@/modules/publishing/domain/lifecycle'
import { generateDrafts } from '@/modules/publishing/domain/drafting'
import { fingerprintSource, type PublishableSource } from '@/kernel/publishing'
import { DEFAULT_PUBLISHING_CONFIG } from '@/modules/publishing/domain/types'

function draft(overrides: Partial<PublishingDraft> = {}): PublishingDraft {
  return {
    id: 'draft-1',
    sourceType: 'campus_session',
    sourceId: 'session-1',
    sourceFingerprint: 'fp-1',
    sourceFields: [{ key: 'summary', label: 'Session summary', value: 'We agreed.', intent: 'copy' }],
    channel: 'linkedin',
    runId: 'run-1',
    variantIndex: 0,
    angle: 'Momentum',
    body: 'Body text',
    aiBody: 'Body text',
    hashtags: ['#PatientAdvocacy'],
    claims: [{ text: 'We agreed.', sourceFieldKey: 'summary' }],
    imageRef: null,
    imageDescription: null,
    omitted: [],
    status: 'pending',
    model: 'claude-sonnet-5',
    contentCalendarId: null,
    createdBy: 'user-1',
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-08-19T00:00:00Z',
    updatedAt: '2026-08-19T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  recorded.length = 0
  vi.clearAllMocks()
  resolveConfigMock.mockResolvedValue({ ...DEFAULT_PUBLISHING_CONFIG })
  createCalendarEntryMock.mockResolvedValue({ ok: true, id: 'cal-1' })
  logIntegrationIntentMock.mockResolvedValue(undefined)
})

describe('editDraft', () => {
  it('writes body only — ai_body is never overwritten', async () => {
    loadDraftMock.mockResolvedValue(draft())
    const result = await editDraft({ draftId: 'draft-1', body: 'Edited text' })
    expect(result.ok).toBe(true)
    const update = recorded.find((call) => call.op === 'update')
    expect(update?.payload).toEqual({ body: 'Edited text' })
    expect(update?.payload).not.toHaveProperty('ai_body')
  })

  it('refuses to edit an approved draft', async () => {
    loadDraftMock.mockResolvedValue(draft({ status: 'approved' }))
    const result = await editDraft({ draftId: 'draft-1', body: 'x' })
    expect(result.ok).toBe(false)
    expect(recorded).toHaveLength(0)
  })
})

describe('approveDraft', () => {
  it('stamps the approver and dismisses the run siblings', async () => {
    loadDraftMock.mockResolvedValue(draft())
    const result = await approveDraft({ draftId: 'draft-1', userId: 'user-9' })
    expect(result.ok).toBe(true)

    const approve = recorded[0]
    expect(approve.payload?.status).toBe('approved')
    expect(approve.payload?.approved_by).toBe('user-9')
    expect(approve.payload?.approved_at).toBeTruthy()
    expect(approve.filters).toMatchObject({ id: 'draft-1', status: 'pending' })

    const siblings = recorded[1]
    expect(siblings.payload).toEqual({ status: 'dismissed' })
    expect(siblings.filters).toMatchObject({ run_id: 'run-1', status: 'pending' })
    expect(siblings.notEq).toEqual(['id', 'draft-1'])
  })

  it('refuses a superseded draft with a clear message', async () => {
    loadDraftMock.mockResolvedValue(draft({ status: 'superseded' }))
    const result = await approveDraft({ draftId: 'draft-1', userId: 'user-9' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/superseded/i)
    expect(recorded).toHaveLength(0)
  })

  it("blocks approval of a stale draft when staleDraftBehaviour is 'block'", async () => {
    loadDraftMock.mockResolvedValue(draft())
    resolveConfigMock.mockResolvedValue({ ...DEFAULT_PUBLISHING_CONFIG, staleDraftBehaviour: 'block' })
    const result = await approveDraft({ draftId: 'draft-1', userId: 'user-9', currentFingerprint: 'fp-2' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/regenerate/i)
    expect(recorded).toHaveLength(0)
  })

  it("warn behaviour lets a stale draft through (the UI shows the warning)", async () => {
    loadDraftMock.mockResolvedValue(draft())
    const result = await approveDraft({ draftId: 'draft-1', userId: 'user-9', currentFingerprint: 'fp-2' })
    expect(result.ok).toBe(true)
  })
})

describe('dismissDraft', () => {
  it('dismisses a pending draft and refuses anything else', async () => {
    loadDraftMock.mockResolvedValue(draft())
    expect((await dismissDraft({ draftId: 'draft-1' })).ok).toBe(true)
    loadDraftMock.mockResolvedValue(draft({ status: 'published' }))
    expect((await dismissDraft({ draftId: 'draft-1' })).ok).toBe(false)
  })
})

// Handover moved to the saved post in ADR-0015 (the post is the copy that keeps
// changing after approval). Its gates are covered by publishing-posts.test.ts.

describe('generateDrafts — supersede on regenerate', () => {
  function source(): PublishableSource {
    const base = {
      sourceType: 'campus_session',
      sourceId: 'session-1',
      title: 'June session',
      occurredAt: '2026-06-24',
      reviewHref: '/x',
      fields: [{ key: 'summary', label: 'Session summary', value: 'x'.repeat(200), intent: 'copy' as const }],
      images: [],
    }
    return { ...base, fingerprint: fingerprintSource(base) }
  }

  it('supersedes the previous pending run before inserting the new one, with ai_body untouched', async () => {
    runAiMessageMock.mockResolvedValue({
      output: {
        variants: [
          { angle: 'One', body: 'Variant one.', hashtags: [], claims: [{ text: 'x', sourceFieldKey: 'summary' }] },
          { angle: 'Two', body: 'Variant two.', hashtags: [], claims: [] },
        ],
        imageDescription: null,
        omitted: [],
      },
      rawResponse: {},
      config: { model: 'claude-sonnet-5', effort: 'medium', source: 'environment' },
      usage: {},
    })

    const result = await generateDrafts({ source: source(), channel: 'linkedin', userId: 'user-1' })
    expect(result.ok).toBe(true)

    expect(recorded[0].op).toBe('update')
    expect(recorded[0].payload).toEqual({ status: 'superseded' })
    expect(recorded[0].filters).toMatchObject({
      source_type: 'campus_session',
      source_id: 'session-1',
      channel: 'linkedin',
      status: 'pending',
    })

    expect(recorded[1].op).toBe('insert')
    const rows = recorded[1].rows ?? []
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ variant_index: 0, status: 'pending', body: 'Variant one.', ai_body: 'Variant one.' })
    expect(rows[1]).toMatchObject({ variant_index: 1, run_id: rows[0].run_id })
  })

  it('writes nothing when a variant cites a field that was never sent (hard visible failure)', async () => {
    runAiMessageMock.mockResolvedValue({
      output: {
        variants: [{ angle: 'One', body: 'Variant.', hashtags: [], claims: [{ text: 'x', sourceFieldKey: 'transcript' }] }],
        imageDescription: null,
        omitted: [],
      },
      rawResponse: {},
      config: { model: 'claude-sonnet-5', effort: 'medium', source: 'environment' },
      usage: {},
    })

    const result = await generateDrafts({ source: source(), channel: 'linkedin', userId: 'user-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("'transcript'")
    expect(recorded).toHaveLength(0)
  })

  it('refuses a declared-but-not-enabled channel and an unready source without calling the model', async () => {
    const declared = await generateDrafts({ source: source(), channel: 'newsletter', userId: 'user-1' })
    expect(declared.ok).toBe(false)
    if (!declared.ok) expect(declared.error).toMatch(/not available/i)

    const thin = source()
    thin.fields = [{ key: 'theme', label: 'Theme', value: 'A theme', intent: 'fact' }]
    const unready = await generateDrafts({ source: thin, channel: 'linkedin', userId: 'user-1' })
    expect(unready.ok).toBe(false)
    if (!unready.ok) expect(unready.error).toMatch(/Not enough/i)

    expect(runAiMessageMock).not.toHaveBeenCalled()
  })
})
