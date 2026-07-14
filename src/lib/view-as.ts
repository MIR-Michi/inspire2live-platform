import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformRole } from './role-access'
import { normalizeRole } from './role-access'

const ROLE_COOKIE_NAME = 'i2l-view-as-role'
const USER_COOKIE_NAME = 'i2l-view-as-user'

const VALID_ROLES: PlatformRole[] = [
  'PatientAdvocate',
  'Clinician',
  'Researcher',
  'Moderator',
  'Comms',
  'HubCoordinator',
  'IndustryPartner',
  'BoardMember',
  'PlatformAdmin',
]

/**
 * Read the "view-as" role cookie on the server (call from Server Components / Actions).
 *
 * The cookie is written client-side by the admin PreviewPanel
 * (components/layouts/preview-panel.tsx), so there is no server-side setter.
 */
export async function getViewAsRole(): Promise<PlatformRole | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(ROLE_COOKIE_NAME)?.value
  if (val && VALID_ROLES.includes(val as PlatformRole)) return val as PlatformRole
  return null
}

/**
 * Read the "view-as user" cookie. The layout validates that the actual logged-in
 * user is PlatformAdmin before this value is used.
 */
export async function getViewAsUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(USER_COOKIE_NAME)?.value
  return val && /^[0-9a-f-]{36}$/i.test(val) ? val : null
}

/**
 * The user whose data a page should render. When the logged-in user is a
 * PlatformAdmin previewing another user (view-as), that previewed user is the
 * "effective viewer"; otherwise it is the logged-in user themselves.
 *
 * This is the single source of truth for the preview precedence + admin gate,
 * so personal surfaces (e.g. the comms dashboard) show the previewed user's
 * data — mirroring how the app layout resolves the effective role/spaces.
 * Only PlatformAdmins can ever preview; a non-admin always resolves to self.
 */
export type EffectiveViewer = {
  /** The real logged-in account. */
  actualUserId: string
  /** The user whose data to render (previewed user, or self). */
  userId: string
  /** Effective role (previewed user's role, or own). */
  role: string | null
  name: string | null
  email: string | null
  /** True when an admin is previewing someone else. */
  isPreviewing: boolean
}

type ProfileRow = { id: string; name: string | null; email: string | null; role: string | null }

export async function resolveEffectiveViewer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<EffectiveViewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: actual } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle()
  const actualProfile = (actual as ProfileRow | null) ?? { id: user.id, name: null, email: user.email ?? null, role: null }

  let effective = actualProfile
  let isPreviewing = false

  if (normalizeRole(actualProfile.role) === 'PlatformAdmin') {
    const viewAsUserId = await getViewAsUserId()
    if (viewAsUserId && viewAsUserId !== user.id) {
      const { data: previewed } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', viewAsUserId)
        .maybeSingle()
      if (previewed) {
        effective = previewed as ProfileRow
        isPreviewing = true
      }
    }
  }

  return {
    actualUserId: user.id,
    userId: effective.id,
    role: effective.role,
    name: effective.name,
    email: effective.email,
    isPreviewing,
  }
}
