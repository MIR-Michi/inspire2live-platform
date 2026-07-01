import { cookies } from 'next/headers'
import type { PlatformRole } from './role-access'

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
