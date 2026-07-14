import { describe, it, expect, vi, beforeEach } from 'vitest'

// getViewAsUserId reads this cookie; drive it per test.
let viewAsUserCookie: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'i2l-view-as-user' && viewAsUserCookie ? { value: viewAsUserCookie } : undefined),
  }),
}))

import { resolveEffectiveViewer } from '@/lib/view-as'

type Profile = { id: string; name: string | null; email: string | null; role: string | null }

const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const NONADMIN = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function fakeSupabase(userId: string | null, profiles: Record<string, Profile>) {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId, email: `${userId}@x` } : null } }) },
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({ data: profiles[val] ?? null }),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const adminProfile: Profile = { id: ADMIN, name: 'Michael', email: 'm@x', role: 'PlatformAdmin' }
const otherProfile: Profile = { id: OTHER, name: 'Atefeh', email: 'a@x', role: 'Comms' }
const nonAdminProfile: Profile = { id: NONADMIN, name: 'Nina', email: 'n@x', role: 'Comms' }

beforeEach(() => {
  viewAsUserCookie = undefined
})

describe('resolveEffectiveViewer', () => {
  it('returns null when unauthenticated', async () => {
    expect(await resolveEffectiveViewer(fakeSupabase(null, {}))).toBeNull()
  })

  it('resolves to self when no preview cookie is set', async () => {
    const v = await resolveEffectiveViewer(fakeSupabase(ADMIN, { [ADMIN]: adminProfile }))
    expect(v).toMatchObject({ userId: ADMIN, name: 'Michael', role: 'PlatformAdmin', isPreviewing: false })
  })

  it('lets an admin preview another user (effective = previewed user)', async () => {
    viewAsUserCookie = OTHER
    const v = await resolveEffectiveViewer(fakeSupabase(ADMIN, { [ADMIN]: adminProfile, [OTHER]: otherProfile }))
    expect(v).toMatchObject({ actualUserId: ADMIN, userId: OTHER, name: 'Atefeh', role: 'Comms', isPreviewing: true })
  })

  it('ignores the preview cookie for a non-admin (always self)', async () => {
    viewAsUserCookie = OTHER
    const v = await resolveEffectiveViewer(fakeSupabase(NONADMIN, { [NONADMIN]: nonAdminProfile, [OTHER]: otherProfile }))
    expect(v).toMatchObject({ userId: NONADMIN, isPreviewing: false })
  })

  it('does not "preview" yourself', async () => {
    viewAsUserCookie = ADMIN
    const v = await resolveEffectiveViewer(fakeSupabase(ADMIN, { [ADMIN]: adminProfile }))
    expect(v).toMatchObject({ userId: ADMIN, isPreviewing: false })
  })

  it('falls back to self when the previewed user does not exist', async () => {
    viewAsUserCookie = OTHER
    const v = await resolveEffectiveViewer(fakeSupabase(ADMIN, { [ADMIN]: adminProfile }))
    expect(v).toMatchObject({ userId: ADMIN, isPreviewing: false })
  })
})
