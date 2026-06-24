import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// resendInvitation looks up a pending account's email/role and delegates to
// inviteUserAccount, which mints a fresh single-use token (a plain resend would
// re-emit the already-spent one). These tests pin down: it only acts on
// un-onboarded accounts, it forwards the looked-up email/role, and it refuses a
// fully-onboarded account.

const mockRevalidatePath = vi.fn()

// requireAdmin() + profile lookup both go through createClient().from(...)
const mockAuthGetUser = vi.fn()
const mockRoleSingle = vi.fn() // requireAdmin → profiles.select(role).eq(id).single()
const mockProfileMaybeSingle = vi.fn() // resend → profiles.select(email,role,onboarding).eq(id).maybeSingle()

// admin client (createAdminClient) used by the delegated inviteUserAccount
const mockAdminProfilesMaybeSingle = vi.fn()
const mockRpc = vi.fn()
const mockDeleteUser = vi.fn()
const mockInviteUserByEmail = vi.fn()

function makeAdminBuilder(table: string) {
  const result = { data: [] as unknown[], error: null as { message?: string } | null }
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'ilike']) {
    builder[m] = () => builder
  }
  builder.maybeSingle = () =>
    table === 'profiles' ? mockAdminProfilesMaybeSingle() : Promise.resolve({ data: null, error: null })
  builder.then = (onF: (v: typeof result) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onF, onR)
  return builder
}

const mockAdmin = {
  from: vi.fn((table: string) => makeAdminBuilder(table)),
  rpc: mockRpc,
  auth: {
    admin: {
      deleteUser: mockDeleteUser,
      inviteUserByEmail: mockInviteUserByEmail,
    },
  },
}

// createClient().from('profiles') is used twice with different terminals:
//  - requireAdmin: …select('role').eq('id', …).single()  → mockRoleSingle
//  - resend:       …select(…).eq('id', …).maybeSingle()  → mockProfileMaybeSingle
const mockSupabase = {
  auth: { getUser: mockAuthGetUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: mockRoleSingle,
        maybeSingle: mockProfileMaybeSingle,
      })),
    })),
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

async function resend(userId = 'pending-1') {
  const { resendInvitation } = await import('@/app/app/admin/users/actions')
  return resendInvitation(userId, ORIGIN)
}

describe('resendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Caller is a PlatformAdmin
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockRoleSingle.mockResolvedValue({ data: { role: 'PlatformAdmin' }, error: null })
    // Delegated invite path defaults: nothing lingering, invite succeeds
    mockAdminProfilesMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockInviteUserByEmail.mockResolvedValue({ error: null })
  })

  it('resends a fresh invite to a pending user using their stored email/role', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { email: 'pending@inspire2live.org', role: 'Comms', onboarding_completed: false },
      error: null,
    })

    const result = await resend()

    expect(result.error).toBeNull()
    expect(mockInviteUserByEmail).toHaveBeenCalledTimes(1)
    expect(mockInviteUserByEmail).toHaveBeenCalledWith(
      'pending@inspire2live.org',
      expect.objectContaining({
        redirectTo: `${ORIGIN}/auth/confirm`,
        data: expect.objectContaining({ role: 'Comms' }),
      }),
    )
  })

  it('refuses to resend for a fully-onboarded account', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { email: 'active@inspire2live.org', role: 'Comms', onboarding_completed: true },
      error: null,
    })

    const result = await resend()

    expect(result.error).toMatch(/already completed onboarding/i)
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('errors when the user has no email on file', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: { email: null, role: 'Comms', onboarding_completed: false },
      error: null,
    })

    const result = await resend()

    expect(result.error).toMatch(/email address/i)
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('rejects a non-admin caller', async () => {
    mockRoleSingle.mockResolvedValue({ data: { role: 'Comms' }, error: null })

    const result = await resend()

    expect(result.error).toMatch(/forbidden/i)
    expect(mockProfileMaybeSingle).not.toHaveBeenCalled()
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })
})
