import { normalizeRole } from './platform-roles'
import { normalizeUserType } from './user-workspace'

export function canAccessCommsWorkspace(
  role: string | null | undefined,
  commsTeam: boolean | null | undefined,
  userType?: string | null | undefined
): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'PlatformAdmin' || normalizeUserType(userType) === 'comms' || (normalized === 'Moderator' && commsTeam === true)
}

export function getPostLoginLandingPath(
  _role: string | null | undefined,
  _commsTeam: boolean | null | undefined,
  _userType?: string | null | undefined
): string {
  return '/app/dashboard'
}
