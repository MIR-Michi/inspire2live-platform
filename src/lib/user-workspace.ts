import type { Database } from '@/types/database'

export type UserType = 'default' | 'comms' | 'board' | 'partner'

export type UserWorkspaceProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  never
> & {
  email?: string | null
  role?: string | null
  comms_team?: boolean | null
  user_type?: string | null
}

const CANONICAL_COMMS_EMAILS = new Set(['marsu101@proton.me'])

const USER_TYPE_LABELS: Record<UserType, string> = {
  default: 'Platform',
  comms: 'Communications',
  board: 'Board',
  partner: 'Partner',
}

export function normalizeUserType(value: string | null | undefined): UserType {
  if (value === 'comms' || value === 'board' || value === 'partner') return value
  return 'default'
}

export function isCommsUser(profile: Pick<UserWorkspaceProfile, 'user_type' | 'comms_team'> | null | undefined): boolean {
  return normalizeUserType(profile?.user_type) === 'comms' || profile?.comms_team === true
}

export function getUserWorkspaceLabel(profileOrType: Pick<UserWorkspaceProfile, 'user_type' | 'comms_team'> | UserType | null | undefined): string {
  if (typeof profileOrType === 'string') return USER_TYPE_LABELS[normalizeUserType(profileOrType)]
  if (isCommsUser(profileOrType)) return USER_TYPE_LABELS.comms
  return USER_TYPE_LABELS[normalizeUserType(profileOrType?.user_type)]
}

export function applyCanonicalCommsFallback<T extends UserWorkspaceProfile | null>(
  profile: T,
  email?: string | null
): T {
  if (!profile || !email || !CANONICAL_COMMS_EMAILS.has(email.toLowerCase())) return profile
  return {
    ...profile,
    comms_team: true,
    user_type: 'comms',
  }
}
