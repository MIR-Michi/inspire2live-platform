export type PlatformRole =
  | 'PatientAdvocate'
  | 'Clinician'
  | 'Researcher'
  | 'Moderator'
  | 'Comms'
  | 'HubCoordinator'
  | 'IndustryPartner'
  | 'BoardMember'
  | 'PlatformAdmin'
  | 'Superadmin'

const DEFAULT_ROLE: PlatformRole = 'PatientAdvocate'

/**
 * Legacy / alternate DB values that may appear in older records.
 * Maps them to the canonical PlatformRole value.
 */
const LEGACY_ROLE_MAP: Record<string, PlatformRole> = {
  patient:          'PatientAdvocate',
  advocate:         'PatientAdvocate',
  patient_advocate: 'PatientAdvocate',
  patientuser:      'PatientAdvocate',
  'patient user':   'PatientAdvocate',
  admin:            'PlatformAdmin',
  platform_admin:   'PlatformAdmin',
  'platform admin': 'PlatformAdmin',
  superadmin:       'Superadmin',
  super_admin:      'Superadmin',
  'super admin':    'Superadmin',
  hub_coordinator:  'HubCoordinator',
  board_member:     'BoardMember',
  industry_partner: 'IndustryPartner',
}

const KNOWN_ROLES: Record<PlatformRole, true> = {
  PatientAdvocate: true,
  Clinician: true,
  Researcher: true,
  Moderator: true,
  Comms: true,
  HubCoordinator: true,
  IndustryPartner: true,
  BoardMember: true,
  PlatformAdmin: true,
  Superadmin: true,
}

export function normalizeRole(role?: string | null): PlatformRole {
  if (!role) return DEFAULT_ROLE
  if ((KNOWN_ROLES as Record<string, true | undefined>)[role]) return role as PlatformRole

  const lower = role.toLowerCase().trim()
  if (lower in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[lower]

  return DEFAULT_ROLE
}

/**
 * Two admin tiers share every permission; they differ only in the ability to
 * "view as" another role/user (Superadmin vs Platform Admin).
 *
 * - `isPlatformAdmin` — has full admin *rights* (both PlatformAdmin and
 *   Superadmin). Use this for every access/permission gate. It mirrors the DB
 *   `current_user_role()`, which collapses Superadmin → PlatformAdmin so RLS
 *   treats both identically.
 * - `isSuperadmin` — the elevated tier that additionally may take other
 *   perspectives (view-as). Use this ONLY to gate the preview/impersonation
 *   feature and the granting of the Superadmin role itself.
 */
export function isPlatformAdmin(role?: string | null): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'PlatformAdmin' || normalized === 'Superadmin'
}

export function isSuperadmin(role?: string | null): boolean {
  return normalizeRole(role) === 'Superadmin'
}
