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
}

export function normalizeRole(role?: string | null): PlatformRole {
  if (!role) return DEFAULT_ROLE
  if ((KNOWN_ROLES as Record<string, true | undefined>)[role]) return role as PlatformRole

  const lower = role.toLowerCase().trim()
  if (lower in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[lower]

  return DEFAULT_ROLE
}
