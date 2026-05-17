import { normalizeRole } from './platform-roles'

export function canAccessCommsWorkspace(
  role: string | null | undefined,
  commsTeam: boolean | null | undefined
): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'PlatformAdmin' || (normalized === 'Moderator' && commsTeam === true)
}

export function getPostLoginLandingPath(
  role: string | null | undefined,
  commsTeam: boolean | null | undefined
): string {
  return canAccessCommsWorkspace(role, commsTeam) ? '/app/comms/intake' : '/app/dashboard'
}
