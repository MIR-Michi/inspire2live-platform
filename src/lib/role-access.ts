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
  Comms:           'Communications',
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
  Comms:           'bg-orange-100 text-orange-700',
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

// ─── Sectioned (grouped) nav ──────────────────────────────────────────────────
//
// The dark, sectioned sidebar — originally the Communications workspace blueprint
// — is the standard layout for every role. Each role's nav items are grouped into
// labelled sections (Overview / Workspace / Events / …). Visibility is still gated
// by the permissions resolver (and DB overrides on the server) per item key.

export type NavSectionItem = {
  key: NavKey
  label: string
  href: string
  /** Renders a live counter badge sourced from the matching workspace metric. */
  badge?: 'campus'
  /** Highlights the item with the accent colour (e.g. the flagship event). */
  priority?: boolean
}

export type NavSection = {
  label: string
  items: NavSectionItem[]
}

export const NAV_SECTIONS_BY_ROLE: Record<PlatformRole, NavSection[]> = {
  PatientAdvocate: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'initiatives', label: 'My Initiatives', href: '/app/initiatives' },
      { key: 'tasks',       label: 'My Tasks',       href: '/app/tasks' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network', label: 'My Network', href: '/app/network' },
      { key: 'stories', label: 'My Stories', href: '/app/stories' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  Clinician: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'initiatives', label: 'My Initiatives', href: '/app/initiatives' },
      { key: 'tasks',       label: 'My Tasks',       href: '/app/tasks' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network', label: 'My Network', href: '/app/network' },
      { key: 'stories', label: 'Stories',    href: '/app/stories' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  Researcher: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'initiatives', label: 'My Initiatives', href: '/app/initiatives' },
      { key: 'tasks',       label: 'My Tasks',       href: '/app/tasks' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network', label: 'My Network', href: '/app/network' },
      { key: 'stories', label: 'Stories',    href: '/app/stories' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  Moderator: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [{ key: 'comms', label: 'Communications', href: '/app/comms' }] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'stories', label: 'Stories',    href: '/app/stories' },
      { key: 'network', label: 'My Network', href: '/app/network' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  Comms: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/comms/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'comms', label: 'Planner',  href: '/app/comms/planner' },
      { key: 'comms', label: 'Campus',   href: '/app/comms/campus', badge: 'campus' },
      { key: 'comms', label: 'WhatsApp', href: '/app/comms/whatsapp' },
      { key: 'comms', label: 'CRM',      href: '/app/comms/crm' },
    ] },
    { label: 'Events',    items: [
      { key: 'congress', label: 'Annual Congress', href: '/app/congress', priority: true },
      { key: 'comms',    label: 'Podcast',         href: '/app/comms/podcast' },
      { key: 'comms',    label: 'All events',      href: '/app/comms/events' },
    ] },
    { label: 'Content',   items: [{ key: 'comms', label: 'Library', href: '/app/comms/library' }] },
  ],
  IndustryPartner: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [{ key: 'partners', label: 'My Engagements', href: '/app/partners' }] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [{ key: 'network', label: 'My Network', href: '/app/network' }] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  BoardMember: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Board Overview', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'board',       label: 'Board View',  href: '/app/board' },
      { key: 'initiatives', label: 'Initiatives', href: '/app/initiatives' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network', label: 'My Network', href: '/app/network' },
      { key: 'stories', label: 'Stories',    href: '/app/stories' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  HubCoordinator: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'bureau',      label: 'Bureau',          href: '/app/bureau' },
      { key: 'initiatives', label: 'All Initiatives', href: '/app/initiatives' },
      { key: 'partners',    label: 'Partners',        href: '/app/partners' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network', label: 'My Network', href: '/app/network' },
      { key: 'stories', label: 'Stories',    href: '/app/stories' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [{ key: 'profile', label: 'Profile', href: '/app/profile' }] },
  ],
  PlatformAdmin: [
    { label: 'Overview',  items: [{ key: 'dashboard', label: 'Dashboard', href: '/app/dashboard' }] },
    { label: 'Workspace', items: [
      { key: 'comms',       label: 'Communications',  href: '/app/comms' },
      { key: 'bureau',      label: 'Bureau',          href: '/app/bureau' },
      { key: 'initiatives', label: 'All Initiatives', href: '/app/initiatives' },
      { key: 'board',       label: 'Board View',      href: '/app/board' },
    ] },
    { label: 'Events',    items: [{ key: 'congress', label: 'Congress', href: '/app/congress/workspace' }] },
    { label: 'Community', items: [
      { key: 'network',  label: 'My Network', href: '/app/network' },
      { key: 'stories',  label: 'Stories',    href: '/app/stories' },
      { key: 'partners', label: 'Partners',   href: '/app/partners' },
    ] },
    { label: 'Resources', items: [{ key: 'resources', label: 'Resources', href: '/app/resources' }] },
    { label: 'Account',   items: [
      { key: 'admin',   label: 'User Management', href: '/app/admin/users' },
      { key: 'profile', label: 'Profile',         href: '/app/profile' },
    ] },
  ],
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
  Comms: [
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
    if (item.key === 'comms' && normalized !== 'PlatformAdmin' && normalized !== 'Comms') {
      return options?.showComms === true
    }
    const level = resolveAccessFromRole(role, item.key as PlatformSpace)
    return level !== 'invisible'
  })
}

/**
 * Returns the grouped (sectioned) nav for a role, used by the dark sidebar and the
 * mobile drawer. Items whose space resolves to 'invisible' are dropped, and any
 * section left empty is removed. Uses the synchronous role-defaults resolver, so
 * it is safe in client components (DB overrides are applied separately on the
 * server via `effectiveSpaces`).
 */
export function getSideNavSections(role: string | null | undefined): NavSection[] {
  const sections = NAV_SECTIONS_BY_ROLE[normalizeRole(role)]
  return sections
    .map((section) => ({
      label: section.label,
      items: section.items.filter(
        (item) => resolveAccessFromRole(role, item.key as PlatformSpace) !== 'invisible',
      ),
    }))
    .filter((section) => section.items.length > 0)
}
