import type { AccessLevel, PlatformSpace } from './permissions'
import { canAccess, resolveAccessFromRole } from './permissions'
import { normalizeRole } from './platform-roles'
import type { PlatformRole } from './platform-roles'
export { normalizeRole, isPlatformAdmin, isSuperadmin } from './platform-roles'
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
  Superadmin:      'Superadmin',
}

/**
 * Tailwind colour classes for role badges.
 * Always use this instead of inline maps in pages/components.
 */
export const ROLE_BADGE_COLORS: Record<PlatformRole, string> = {
  Superadmin:      'bg-red-200 text-red-900',
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

// ─── Unified navigation (single master tree) ──────────────────────────────────
//
// There is exactly ONE navigation tree for the whole platform. The dark, sectioned
// sidebar — originally the Communications workspace blueprint — is the standard for
// every role. Roles do NOT get their own menus; each role sees a *filtered view* of
// this tree, derived from the permission matrix (`effectiveSpaces`, which already
// folds in per-user DB overrides). Granting a user access to a space automatically
// reveals its menu items — no menu code changes.
//
// Visibility rule per item: canAccess(spaces[item.space], item.minLevel ?? 'view').
//
// Deliberately NOT in the tree (still reachable elsewhere): Profile (top-right
// account menu), Tasks / Bureau / Partners, Annual Congress, and conference guest
// submissions (now surfaced from the Conferences workspace).

/** Icon keys resolved to an SVG in the sidebar. */
export type NavIcon =
  | 'dashboard'
  | 'planner'
  | 'campus'
  | 'whatsapp'
  | 'crm'
  | 'initiatives'
  | 'board'
  | 'congress'
  | 'conferences'
  | 'podcast'
  | 'events'
  | 'network'
  | 'library'
  | 'resources'
  | 'admin'
  | 'feedback'
  | 'settings'

export type NavItem = {
  /** Stable id for keys/tests. */
  id: string
  label: string
  href: string
  /** Space that gates visibility. */
  space: PlatformSpace
  /** Icon shown to the left of the label. */
  icon: NavIcon
  /** Minimum access level required to see the item (defaults to 'view'). */
  minLevel?: AccessLevel
  /** Renders a live counter badge sourced from the matching workspace metric. */
  badge?: 'campus'
  /** Optional accent treatment supported by the shared sidebar renderer. */
  priority?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const MASTER_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/app/dashboard', space: 'dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'comms-planner',  label: 'Planner',     href: '/app/comms/planner',  space: 'comms', icon: 'planner' },
      { id: 'comms-campus',   label: 'Campus',      href: '/app/comms/campus',   space: 'comms', icon: 'campus', badge: 'campus' },
      { id: 'comms-whatsapp', label: 'WhatsApp',    href: '/app/comms/whatsapp', space: 'comms', icon: 'whatsapp' },
      { id: 'comms-crm',      label: 'CRM',         href: '/app/comms/crm',      space: 'comms', icon: 'crm' },
      { id: 'initiatives',    label: 'Initiatives', href: '/app/initiatives',    space: 'initiatives', icon: 'initiatives' },
    ],
  },
  {
    label: 'Events',
    items: [
      { id: 'comms-conferences', label: 'Conferences', href: '/app/comms/conferences', space: 'comms', icon: 'events' },
      { id: 'comms-podcast',     label: 'Podcast',     href: '/app/comms/podcast',     space: 'comms', icon: 'podcast' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'comms-library', label: 'Library',   href: '/app/comms/library', space: 'comms', icon: 'library' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { id: 'settings', label: 'Platform Settings', href: '/app/settings', space: 'admin', icon: 'settings', minLevel: 'manage' },
    ],
  },
]

// The Communications role keeps its original curated blueprint *exactly* — it is the
// canonical comms workspace, not a permission-expanded view. Every other role sees
// the permission-driven MASTER_NAV (Comms is the baseline; broader roles such as
// Admin extend it with the platform-wide items). Items here are still permission-
// gated as a safety net, but the curated set is what keeps the Comms menu lean and
// stable instead of surfacing every space the role happens to have access to.
//
// Note: the Comms dashboard is its own page (/app/comms/dashboard) with the
// personal/team toggle — distinct from the shared /app/dashboard other roles use.
const COMMS_NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { id: 'comms-dashboard', label: 'Dashboard', href: '/app/comms/dashboard', space: 'dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'comms-planner',  label: 'Planner',  href: '/app/comms/planner',  space: 'comms', icon: 'planner' },
      { id: 'comms-campus',   label: 'Campus',   href: '/app/comms/campus',   space: 'comms', icon: 'campus', badge: 'campus' },
      { id: 'comms-whatsapp', label: 'WhatsApp', href: '/app/comms/whatsapp', space: 'comms', icon: 'whatsapp' },
      { id: 'comms-crm',      label: 'CRM',      href: '/app/comms/crm',      space: 'comms', icon: 'crm' },
    ],
  },
  {
    label: 'Events',
    items: [
      { id: 'comms-conferences', label: 'Conferences', href: '/app/comms/conferences', space: 'comms', icon: 'events' },
      { id: 'comms-podcast',     label: 'Podcast',     href: '/app/comms/podcast',     space: 'comms', icon: 'podcast' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'comms-library', label: 'Library', href: '/app/comms/library', space: 'comms', icon: 'library' },
    ],
  },
]

function getAppSection(pathname: string): string | null {
  if (!pathname.startsWith('/app')) return null
  if (pathname === '/app' || pathname === '/app/') return 'dashboard'
  const [, , section] = pathname.split('/')
  // The Platform Settings space (ADR-0010) is served at /app/settings but keeps
  // the RBAC space id `admin` — no permission-matrix migration. Alias it here so
  // middleware and nav gate it exactly like the legacy /app/admin routes.
  if (section === 'settings') return 'admin'
  return section || 'dashboard'
}

/**
 * Legacy top-level spaces retired in the cleanup sprint (Sprint 15). They are
 * removed from navigation and blocked here so every route + subroute redirects
 * to the dashboard, regardless of role. Kept as a single list so the retirement
 * is one reversible chokepoint until the page code is deleted in a later batch.
 */
const RETIRED_APP_SECTIONS: ReadonlySet<string> = new Set([
  'board',
  'network',
  'stories',
  'resources',
  'congress',
  'bureau',
  'notifications',
])

/** True for the retired generic Events *list* page only — its `[id]` detail is kept. */
function isRetiredEventsList(pathname: string): boolean {
  return pathname === '/app/comms/events' || pathname === '/app/comms/events/'
}

/**
 * Synchronous route-access check — safe for use in middleware.
 * Delegates to resolveAccessFromRole() from permissions.ts.
 * A user can access a path if their effective access level is 'view' or above (not 'invisible').
 */
export function canAccessAppPath(role: string | null | undefined, pathname: string): boolean {
  const section = getAppSection(pathname)
  if (!section) return true

  // Retired spaces are inaccessible to everyone (Sprint 15 cleanup).
  if (RETIRED_APP_SECTIONS.has(section) || isRetiredEventsList(pathname)) return false

  const level = resolveAccessFromRole(role, section as PlatformSpace)
  return level !== 'invisible'
}

/**
 * Filters the navigation tree down to the sections/items a user may see, given
 * their resolved access levels per space. The Communications role uses its curated
 * blueprint (`COMMS_NAV_SECTIONS`); every other role uses the permission-driven
 * `MASTER_NAV`. Items the user cannot reach are dropped and empty sections removed.
 * Pure function — pass the same `effectiveSpaces` map used to render the sidebar
 * (server-resolved, includes DB overrides) so the desktop sidebar and the mobile
 * drawer stay in lockstep.
 */
export function getSideNavSections(
  role: string | null | undefined,
  spaces: Record<PlatformSpace, AccessLevel>,
): NavSection[] {
  const tree = normalizeRole(role) === 'Comms' ? COMMS_NAV_SECTIONS : MASTER_NAV
  return tree
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) =>
        canAccess(spaces[item.space], item.minLevel ?? 'view'),
      ),
    }))
    .filter((section) => section.items.length > 0)
}
