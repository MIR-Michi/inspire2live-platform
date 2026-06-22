import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// inviteUserAccount must, when re-inviting an email after a delete, purge any
// lingering record so Supabase mints a BRAND-NEW invite token. If a stale
// auth.users row survives, inviteUserByEmail resends an already-spent token and
// the emailed link verifies as "expired or already used". These tests pin that
// purge-before-invite behaviour down at the server-action level (the GoTrue
// token mechanics themselves can't run in unit tests).

const mockRevalidatePath = vi.fn()

// requireAdmin() client (createClient)
const mockAuthGetUser = vi.fn()
const mockProfilesSingle = vi.fn()

// admin client (createAdminClient)
const mockProfilesMaybeSingle = vi.fn()
const mockRpc = vi.fn()
const mockDeleteUser = vi.fn()
const mockInviteUserByEmail = vi.fn()

/**
 * A permissive chainable query builder so cleanupUserContent (which touches many
 * tables) just resolves to empty/no-error. profiles.…maybeSingle() returns the
 * configured profile; everything else awaits to { data: [], error: null }.
 */
function makeBuilder(table: string) {
  const result = { data: [] as unknown[], error: null as { message?: string } | null }
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'ilike']) {
    builder[m] = () => builder
  }
  builder.maybeSingle = () =>
    table === 'profiles' ? mockProfilesMaybeSingle() : Promise.resolve({ data: null, error: null })
  // thenable so `await admin.from(t).update().in(...)` resolves
  builder.then = (onF: (v: typeof result) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onF, onR)
  return builder
}

const mockAdmin = {
  from: vi.fn((table: string) => makeBuilder(table)),
  rpc: mockRpc,
  auth: {
    admin: {
      deleteUser: mockDeleteUser,
      inviteUserByEmail: mockInviteUserByEmail,
    },
  },
}

const mockSupabase = {
  auth: { getUser: mockAuthGetUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockProfilesSingle })) })),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdmin),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

const ORIGIN = 'https://app.inspire2live.org'

async function invite(email = 'self@inspire2live.org', role = 'PatientAdvocate') {
  const { inviteUserAccount } = await import('@/app/app/admin/users/actions')
  return inviteUserAccount(email, role, ORIGIN)
}

describe('inviteUserAccount — re-invite after delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Caller is a PlatformAdmin
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockProfilesSingle.mockResolvedValue({ data: { role: 'PlatformAdmin' }, error: null })
    // Defaults: no existing profile, no lingering auth user, deletes/invites succeed
    mockProfilesMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockInviteUserByEmail.mockResolvedValue({ error: null })
  })

  it('clean re-invite (no leftovers) mints a fresh invite', async () => {
    const result = await invite()
    expect(result.error).toBeNull()
    expect(mockInviteUserByEmail).toHaveBeenCalledTimes(1)
    expect(mockInviteUserByEmail).toHaveBeenCalledWith(
      'self@inspire2live.org',
      expect.objectContaining({ redirectTo: `${ORIGIN}/auth/callback` }),
    )
  })

  it('purges an orphaned auth.users row (no profile) BEFORE inviting', async () => {
    // Delete left an orphan auth user with no profile row.
    mockProfilesMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc
      .mockResolvedValueOnce({ data: 'orphan-id', error: null }) // initial lookup
      .mockResolvedValueOnce({ data: null, error: null }) // post-purge: gone

    const result = await invite()

    expect(result.error).toBeNull()
    expect(mockDeleteUser).toHaveBeenCalledWith('orphan-id')
    // The orphan must be purged before the invite is sent.
    const deleteOrder = mockDeleteUser.mock.invocationCallOrder[0]
    const inviteOrder = mockInviteUserByEmail.mock.invocationCallOrder[0]
    expect(deleteOrder).toBeLessThan(inviteOrder)
  })

  it('purges an un-onboarded profile before inviting', async () => {
    mockProfilesMaybeSingle.mockResolvedValue({
      data: { id: 'pending-id', onboarding_completed: false },
      error: null,
    })
    mockRpc.mockResolvedValue({ data: null, error: null }) // nothing left after profile delete

    const result = await invite()

    expect(result.error).toBeNull()
    expect(mockDeleteUser).toHaveBeenCalledWith('pending-id')
    expect(mockInviteUserByEmail).toHaveBeenCalledTimes(1)
  })

  it('blocks re-invite of a fully onboarded account (must delete first)', async () => {
    mockProfilesMaybeSingle.mockResolvedValue({
      data: { id: 'active-id', onboarding_completed: true },
      error: null,
    })

    const result = await invite()

    expect(result.error).toMatch(/active account/i)
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('does NOT invite (and surfaces an error) when the purge fails', async () => {
    // Orphan exists but deleteUser fails with a non-"not found" error, and the
    // profile fallback delete also fails → removeAccount returns ok:false.
    mockRpc.mockResolvedValue({ data: 'stuck-id', error: null })
    mockDeleteUser.mockResolvedValue({ error: { message: 'boom', status: 500 } })
    mockAdmin.from.mockImplementation((table: string) => {
      const b = makeBuilder(table) as Record<string, unknown>
      if (table === 'profiles') {
        // make the fallback profile delete fail too
        b.delete = () => ({ eq: () => Promise.resolve({ error: { message: 'still boom' } }) })
      }
      return b
    })

    const result = await invite()

    expect(result.error).toMatch(/could not clear the previous record/i)
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('purges a lingering auth user that the profile delete left behind (safety net)', async () => {
    // Un-onboarded profile is removed, but an auth.users row with the same email
    // survives (id mismatch). The post-purge lookup must catch and remove it.
    mockProfilesMaybeSingle.mockResolvedValue({
      data: { id: 'profile-id', onboarding_completed: false },
      error: null,
    })
    mockRpc
      .mockResolvedValueOnce({ data: 'leftover-auth-id', error: null }) // safety-net lookup finds it
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await invite()

    expect(result.error).toBeNull()
    expect(mockDeleteUser).toHaveBeenCalledWith('profile-id')
    expect(mockDeleteUser).toHaveBeenCalledWith('leftover-auth-id')
    expect(mockInviteUserByEmail).toHaveBeenCalledTimes(1)
  })
})
