import { cookies } from 'next/headers'
import type { PlatformRole } from './role-access'

const COOKIE_NAME = 'i2l-view-as-role'

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
 * Read the "view-as" cookie on the server (call from Server Components / Actions).
 *
 * The cookie is written client-side by the admin PreviewPanel
 * (components/layouts/preview-panel.tsx), so there is no server-side setter.
 */
export async function getViewAsRole(): Promise<PlatformRole | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(COOKIE_NAME)?.value
  if (val && VALID_ROLES.includes(val as PlatformRole)) return val as PlatformRole
  return null
}
