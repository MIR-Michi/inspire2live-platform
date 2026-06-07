import { normalizeRole } from './platform-roles'

export function canAccessCommsWorkspace(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'PlatformAdmin' || normalized === 'Comms'
}

export function getPostLoginLandingPath(_role: string | null | undefined): string {
  return '/app/dashboard'
}
