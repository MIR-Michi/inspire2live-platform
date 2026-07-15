import { normalizeRole } from '@/lib/role-access'

export type DashboardVariant = 'coordinator' | 'board' | 'advocate'

export function resolveDashboardVariant(role?: string | null): DashboardVariant {
  const normalized = normalizeRole(role)
  if (normalized === 'HubCoordinator' || normalized === 'PlatformAdmin' || normalized === 'Superadmin') return 'coordinator'
  if (normalized === 'BoardMember') return 'board'
  return 'advocate'
}

export function buildDashboardGreeting(name?: string | null): string {
  if (!name?.trim()) return 'Welcome.'
  return `Good work, ${name.trim().split(' ')[0]}.`
}
