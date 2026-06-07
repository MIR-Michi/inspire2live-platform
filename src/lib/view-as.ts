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

/** Read the "view-as" cookie on the server (call from Server Components / Actions) */
export async function getViewAsRole(): Promise<PlatformRole | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(COOKIE_NAME)?.value
  if (val && VALID_ROLES.includes(val as PlatformRole)) return val as PlatformRole
  return null
}

/** Set or clear the "view-as" cookie (call from Server Actions only) */
export async function setViewAsRole(role: PlatformRole | null) {
  const cookieStore = await cookies()
  if (!role || role === 'PlatformAdmin') {
    cookieStore.delete(COOKIE_NAME)
  } else {
    cookieStore.set(COOKIE_NAME, role, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: 60 * 60 * 24, // 1 day
    })
  }
}
