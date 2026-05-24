import { cookies } from 'next/headers'
import type { PlatformRole } from './role-access'
import { normalizeUserType, type UserType } from './user-workspace'

const COOKIE_NAME = 'i2l-view-as-role'
const WORKSPACE_COOKIE_NAME = 'i2l-view-as-user-type'

const VALID_ROLES: PlatformRole[] = [
  'PatientAdvocate',
  'Clinician',
  'Researcher',
  'Moderator',
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

/** Read the workspace/user-type preview cookie on the server. */
export async function getViewAsUserType(): Promise<UserType | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value
  const normalized = normalizeUserType(val)
  return normalized === 'default' ? null : normalized
}

/** Set or clear the workspace/user-type preview cookie. */
export async function setViewAsUserType(userType: UserType | null) {
  const cookieStore = await cookies()
  const normalized = normalizeUserType(userType)
  if (normalized === 'default') {
    cookieStore.delete(WORKSPACE_COOKIE_NAME)
  } else {
    cookieStore.set(WORKSPACE_COOKIE_NAME, normalized, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    })
  }
}
