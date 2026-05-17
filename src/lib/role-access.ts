import type { PlatformSpace } from './permissions'
import { resolveAccessFromRole } from './permissions'
import { normalizeRole } from './platform-roles'
import type { PlatformRole } from './platform-roles'
export { normalizeRole } from './platform-roles'
export type { PlatformRole } from './platform-roles'

/**
 * Human-readable labels for every platform role.
 * Always use this map when displaying role names in the UI.
 * Never render raw DB values directly.
 */
export const ROLE_LABELS: Record<PlatformRole, string> = {
  PatientAdvocate: 'Patient Advocate',
  Clinician:       'Clinician',
  Researcher:      'Researcher',
  Moderator:       'Moderator',
  HubCoordinator:  'Hub Coordinator',
  IndustryPartner: 'Industry Partner',
  BoardMember:     'Board Member',
  PlatformAdmin:   'Platform Admin',
}

/**
 * Tailwind colour classes for role badges.
 * Always use this instead of inline maps in pages/components.
 */
export const ROLE_BADGE_COLORS: Record<PlatformRole, string> = {
  PlatformAdmin:   'bg-red-100 text-red-700',
  BoardMember:     'bg-purple-100 text-purple-700',
  HubCoordinator:  'bg-orange-100 text-orange-700',
  PatientAdvocate: 'bg-blue-100 text-blue-700',
  Researcher:      'bg-emerald-100 text-emerald-700',
  Clinician:       'bg-teal-100 text-teal-700',
  Moderator:       'bg-pink-100 text-pink-700',
  IndustryPartner: 'bg-amber-100 text-amber-700',
}

/**
 * Returns the human-readable label for any role string,
 * including legacy values. Safe to call with untrusted DB data.
 */
export function getRoleLabel(role?: string | null): string {
  if (!role) return ROLE_LABELS.PatientAdvocate
  const normalized = normalizeRole(role)
  return ROLE_LABELS[normalized]
}

/**
 * Returns the badge colour classes for any role string.
 */
export function getRoleBadgeColor(role?: string | null): string {
  const normalized = normalizeRole(role)
  return ROLE_BADGE_COLORS[normalized] ?? 'bg-neutral-100 text-neutral-600'
}

export type NavKey =
  | 'dashboard'
  | 'comms'
  | 'initiatives'
  | 'tasks'
  | 'bureau'
  | 'congress'
  | 'stories'
  | 'resources'
  | 'partners'
  | 'network'
  | 'board'
  | 'notifications'
  | 'profile'
  | 'admin'

export type NavItemConfig = {
  key: NavKey
  label: string
  href: string
}

const NAV_BY_ROLE: Record<PlatformRole, NavItemConfig[]> = {
  PatientAdvocate: [
    { key: 'dashboard',     label: 'Dashboard',      href: '/app/dashboard' },
    { key: 'initiatives',   label: 'My Initiatives', href: '/app/initiatives' },
    { key: 'tasks',         label: 'My Tasks',       href: '/app/tasks' },
    { key: 'network',       label: 'My Network',     href: '/app/network' },
    { key: 'congress',      label: 'Congress',       href: '/app/congress/workspace' },
    { key: 'stories',       label: 'My Stories',     href: '/app/stories' },
    { key: 'resources',     label: 'Resources',      href: '/app/resources' },
    { key: 'profile',       label: 'Profile',        href: '/app/profile' },
  ],
  Clinician: [
    { key: 'dashboard',     label: 'Dashboard',      href: '/app/dashboard' },
    { key: 'initiatives',   label: 'My Initiatives', href: '/app/initiatives' },
    { key: 'tasks',         label: 'My Tasks',       href: '/app/tasks' },
    { key: 'network',       label: 'My Network',     href: '/app/network' },
    { key: 'congress',      label: 'Congress',       href: '/app/congress/workspace' },
    { key: 'stories',       label: 'Stories',        href: '/app/stories' },
    { key: 'resources',     label: 'Resources',      href: '/app/resources' },
    { key: 'profile',       label: 'Profile',        href: '/app/profile' },
  ],
  Researcher: [
    { key: 'dashboard',     label: 'Dashboard',      href: '/app/dashboard' },
    { key: 'initiatives',   label: 'My Initiatives', href: '/app/initiatives' },
    { key: 'tasks',         label: 'My Tasks',       href: '/app/tasks' },
    { key: 'network',       label: 'My Network',     href: '/app/network' },
    { key: 'congress',      label: 'Congress',       href: '/app/congress/workspace' },
    { key: 'stories',       label: 'Stories',        href: '/app/stories' },
    { key: 'resources',     label: 'Resources',      href: '/app/resources' },
    { key: 'profile',       label: 'Profile',        href: '/app/profile' },
  ],
  Moderator: [
    { key: 'dashboard',     label: 'Dashboard',       href: '/app/dashboard' },
    { key: 'comms',         label: 'Communications',  href: '/app/comms' },
    { key: 'stories',       label: 'Stories',         href: '/app/stories' },
    { key: 'network',       label: 'My Network',      href: '/app/network' },
    { key: 'congress',      label: 'Congress',        href: '/app/congress/workspace' },
    { key: 'resources',     label: 'Resources',       href: '/app/resources' },
    { key: 'profile',       label: 'Profile',         href: '/app/profile' },
  ],
  IndustryPartner: [
    { key: 'dashboard',     label: 'Dashboard',      href: '/app/dashboard' },
    { key: 'partners',      label: 'My Engagements', href: '/app/partners' },
    { key: 'network',       label: 'My Network',     href: '/app/network' },
    { key: 'congress',      label: 'Congress',       href: '/app/congress/workspace' },
    { key: 'resources',     label: 'Resources',      href: '/app/resources' },
    { key: 'profile',       label: 'Profile',        href: '/app/profile' },
  ],
  BoardMember: [
    { key: 'dashboard',     label: 'Board Overview', href: '/app/dashboard' },
    { key: 'board',         label: 'Board View',     href: '/app/board' },
    { key: 'initiatives',   label: 'Initiatives',    href: '/app/initiatives' },
    { key: 'network',       label: 'My Network',     href: '/app/network' },
    { key: 'congress',      label: 'Congress',       href: '/app/congress/workspace' },
    { key: 'stories',       label: 'Stories',        href: '/app/stories' },
    { key: 'resources',     label: 'Resources',      href: '/app/resources' },
    { key: 'profile',       label: 'Profile',        href: '/app/profile' },
  ],
  HubCoordinator: [
    { key: 'dashboard',     label: 'Dashboard',       href: '/app/dashboard' },
    { key: 'bureau',        label: 'Bureau',          href: '/app/bureau' },
    { key: 'initiatives',   label: 'All Initiatives', href: '/app/initiatives' },
    { key: 'network',       label: 'My Network',      href: '/app/network' },
    { key: 'congress',      label: 'Congress',        href: '/app/congress/workspace' },
    { key: 'stories',       label: 'Stories',         href: '/app/stories' },
    { key: 'partners',      label: 'Partners',        href: '/app/partners' },
    { key: 'resources',     label: 'Resources',       href: '/app/resources' },
    { key: 'profile',       label: 'Profile',         href: '/app/profile' },
  ],
  PlatformAdmin: [
    { key: 'dashboard',     label: 'Dashboard',       href: '/app/dashboard' },
    { key: 'comms',         label: 'Communications',  href: '/app/comms' },
    { key: 'bureau',        label: 'Bureau',          href: '/app/bureau' },
    { key: 'initiatives',   label: 'All Initiatives', href: '/app/initiatives' },
    { key: 'network',       label: 'My Network',      href: '/app/network' },
    { key: 'board',         label: 'Board View',      href: '/app/board' },
    { key: 'congress',      label: 'Congress',        href: '/app/congress/workspace' },
    { key: 'stories',       label: 'Stories',         href: '/app/stories' },
    { key: 'partners',      label: 'Partners',        href: '/app/partners' },
    { key: 'resources',     label: 'Resources',       href: '/app/resources' },
    { key: 'admin',         label: 'User Management', href: '/app/admin/users' },
    { key: 'profile',       label: 'Profile',         href: '/app/profile' },
  ],
}

function getAppSection(pathname: string): string | null {
  if (!pathname.startsWith('/app')) return null
  if (pathname === '/app' || pathname === '/app/') return 'dashboard'
  const [, , section] = pathname.split('/')
  return section || 'dashboard'
}

/**
 * Synchronous route-access check — safe for use in middleware.
 * Delegates to resolveAccessFromRole() from permissions.ts.
 * A user can access a path if their effective access level is 'view' or above (not 'invisible').
 */
export function canAccessAppPath(role: string | null | undefined, pathname: string): boolean {
  const section = getAppSection(pathname)
  if (!section) return true

  const level = resolveAccessFromRole(role, section as PlatformSpace)
  return level !== 'invisible'
}

/**
 * Returns filtered nav items for a role, excluding any space with access level 'invisible'.
 * Uses the permissions resolver as the gate — single source of truth.
 */
export function getSideNavItems(
  role: string | null | undefined,
  options?: { showComms?: boolean }
): NavItemConfig[] {
  const normalized = normalizeRole(role)
  const all = NAV_BY_ROLE[normalizeRole(role)]
  return all.filter((item) => {
    if (item.key === 'comms' && normalized !== 'PlatformAdmin') {
      return options?.showComms === true
    }
    const level = resolveAccessFromRole(role, item.key as PlatformSpace)
    return level !== 'invisible'
  })
}
