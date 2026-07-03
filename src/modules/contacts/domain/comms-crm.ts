export const CRM_SEGMENT_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
] as const

export type CrmSegment = (typeof CRM_SEGMENT_OPTIONS)[number]['value']
export type CrmRelationshipHealth = 'active' | 'nurture' | 'follow_up' | 'archived'
export type CrmSourceType = 'manual' | 'profile' | 'campus_member'
export type CrmConsentStatus = 'unknown' | 'granted' | 'declined' | 'not_required'

// ─── Contact kind & platform-account state (Sprint 13) ───────────────────────
//
// `contact_kind` replaces the binary internal/external split with the three
// first-class categories. `segment` is kept as a derived value (internal_user
// and internal_contact → 'internal'; external → 'external') so existing filters
// keep working.
//
//   internal_user    — invited via User Management; has a platform profile.
//   internal_contact — internal I2L person (incl. World Campus members) who is
//                      NOT a platform user and not currently meant to be one.
//                      The default, terminal state — never "pending".
//   external         — third-party contact.
//
// "Pending" is NOT a kind. It is the transient platform_status='invited' state,
// which only ever arises from a User-Management invite.

export const CRM_CONTACT_KIND_OPTIONS = [
  { value: 'internal_user', label: 'Internal · user' },
  { value: 'internal_contact', label: 'Internal · contact' },
  { value: 'external', label: 'External' },
] as const

export type CrmContactKind = (typeof CRM_CONTACT_KIND_OPTIONS)[number]['value']

export const CRM_PLATFORM_STATUS_OPTIONS = [
  { value: 'none', label: 'Not on platform' },
  { value: 'invited', label: 'Invited (pending)' },
  { value: 'active', label: 'Active user' },
  { value: 'inactive', label: 'Deactivated' },
] as const

export type CrmPlatformStatus = (typeof CRM_PLATFORM_STATUS_OPTIONS)[number]['value']

/** Inspire2Live email domain — internal people use addresses on this domain. */
export const INTERNAL_EMAIL_DOMAIN = 'inspire2live.org'

const CRM_CONTACT_KIND_SET = new Set(CRM_CONTACT_KIND_OPTIONS.map((o) => o.value))
const CRM_PLATFORM_STATUS_SET = new Set(CRM_PLATFORM_STATUS_OPTIONS.map((o) => o.value))

/** Lower-cases and trims an email; returns null for blank/invalid input. */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 && trimmed.includes('@') ? trimmed : null
}

/** True when the email belongs to the Inspire2Live internal domain. */
export function isInternalEmail(
  value: string | null | undefined,
  domain: string = INTERNAL_EMAIL_DOMAIN
): boolean {
  const normalized = normalizeEmail(value)
  return normalized ? normalized.endsWith(`@${domain.toLowerCase()}`) : false
}

/**
 * Derives the contact kind from the available signals. A linked platform
 * profile always means `internal_user`; otherwise an Inspire2Live email means
 * `internal_contact`; everything else is `external`. Never returns a "pending"
 * value — pending is a platform_status, not a kind.
 */
export function deriveContactKind({
  profileId,
  email,
  isCampusMember = false,
}: {
  profileId?: string | null
  email?: string | null
  isCampusMember?: boolean
}): CrmContactKind {
  if (profileId) return 'internal_user'
  // World Campus members are internal contacts without platform access.
  if (isCampusMember) return 'internal_contact'
  if (isInternalEmail(email)) return 'internal_contact'
  return 'external'
}

/** Derives the back-compat `segment` from a contact kind. */
export function segmentFromKind(kind: CrmContactKind): CrmSegment {
  return kind === 'external' ? 'external' : 'internal'
}

export function normalizeContactKind(value: string | null | undefined): CrmContactKind | null {
  return CRM_CONTACT_KIND_SET.has(value as CrmContactKind) ? (value as CrmContactKind) : null
}

export function normalizePlatformStatus(value: string | null | undefined): CrmPlatformStatus {
  return CRM_PLATFORM_STATUS_SET.has(value as CrmPlatformStatus) ? (value as CrmPlatformStatus) : 'none'
}

export function getCrmContactKindLabel(value: string | null | undefined) {
  return CRM_CONTACT_KIND_OPTIONS.find((o) => o.value === value)?.label ?? 'Internal · contact'
}

export function getCrmPlatformStatusLabel(value: string | null | undefined) {
  return CRM_PLATFORM_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'Not on platform'
}

export const CRM_PERSON_TYPE_OPTIONS = [
  { value: 'comms', label: 'Comms' },
  { value: 'patient_advocate', label: 'Patient Advocate' },
  { value: 'clinician', label: 'Clinician' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'governmental', label: 'Governmental' },
  { value: 'patient', label: 'Patient' },
] as const

export type CrmPersonType = (typeof CRM_PERSON_TYPE_OPTIONS)[number]['value']

// ─── Continent (geo facet from the community import) ─────────────────────────

export const CRM_CONTINENT_OPTIONS = [
  { value: 'Europe', label: 'Europe' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Asia', label: 'Asia' },
  { value: 'North America', label: 'North America' },
  { value: 'South America', label: 'South America' },
  { value: 'Oceania', label: 'Oceania' },
  { value: 'Antarctica', label: 'Antarctica' },
] as const

export type CrmContinent = (typeof CRM_CONTINENT_OPTIONS)[number]['value']

const CRM_CONTINENT_SET = new Set(CRM_CONTINENT_OPTIONS.map((option) => option.value))

export function normalizeCrmContinent(value: string | null | undefined): CrmContinent | null {
  return CRM_CONTINENT_SET.has(value as CrmContinent) ? (value as CrmContinent) : null
}

// ─── Public-footprint links (publications / talks / media / profiles) ────────

export type CrmContactLinkKind = 'publication' | 'talk' | 'media' | 'profile' | 'linkedin' | 'other'

export type CrmContactLink = {
  id: string
  kind: CrmContactLinkKind
  label: string
  url: string | null
}

export const CRM_CONTACT_LINK_KIND_LABELS: Record<CrmContactLinkKind, string> = {
  publication: 'Publications',
  talk: 'Talks',
  media: 'Media',
  profile: 'Profiles',
  linkedin: 'LinkedIn',
  other: 'Links',
}

const CRM_PERSON_TYPE_SET = new Set(CRM_PERSON_TYPE_OPTIONS.map((option) => option.value))

export function normalizeCrmPersonType(value: string | null | undefined): CrmPersonType | null {
  return CRM_PERSON_TYPE_SET.has(value as CrmPersonType) ? (value as CrmPersonType) : null
}

export function getCrmPersonTypeLabel(value: string | null | undefined) {
  if (!value) return 'Unclassified'
  return CRM_PERSON_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export const CRM_LIFECYCLE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'archived', label: 'Archived' },
] as const

export const CRM_CONSENT_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'granted', label: 'Granted' },
  { value: 'declined', label: 'Declined' },
  { value: 'not_required', label: 'Not required' },
] as const

export const CRM_INTERACTION_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'event', label: 'Event' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'follow_up', label: 'Follow-up' },
] as const

export type CrmInteractionType = (typeof CRM_INTERACTION_OPTIONS)[number]['value']

export type CrmSelectOption = {
  id: string
  label: string
  meta?: string | null
}

export type CrmConnectorBacklogItem = {
  id: string
  integrationTarget: string
  useCase: string
  status: string
  guardrail: string
}

export type CrmContactRecord = {
  id: string
  crmContactId: string | null
  sourceType: CrmSourceType
  sourceId: string | null
  fullName: string
  segment: CrmSegment
  contactKind: CrmContactKind
  platformStatus: CrmPlatformStatus
  intendedRole: string | null
  profileId: string | null
  personType: CrmPersonType | null
  isCampusMember: boolean
  fieldOfExpertise: string[]
  skills: string[]
  pictureUrl: string | null
  bio: string | null
  title: string | null
  organisation: string | null
  organisationUrl: string | null
  linkedinUrl: string | null
  continent: CrmContinent | null
  links: CrmContactLink[]
  associatedProjects: string[]
  associatedProjectIds: string[]
  associatedEvents: string[]
  associatedEventIds: string[]
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  preferredChannel: string | null
  relationshipOwner: string | null
  relationshipOwnerId: string | null
  health: CrmRelationshipHealth
  lastInteractionAt: string | null
  nextFollowUpAt: string | null
  consentStatus: CrmConsentStatus
  privacyNotes: string | null
  retentionReviewAt: string | null
  sourceLabel: string
  tags: string[]
  notes: string | null
  recentInteractions: Array<{
    id: string
    type: string
    summary: string
    occurredAt: string
    nextFollowUpAt: string | null
  }>
  conferences: Array<{
    id: string
    name: string
    startDate: string | null
    role: string
  }>
}

export const CRM_FIELD_GROUPS = [
  {
    title: 'Identity',
    fields: ['Picture', 'Full name', 'Role or title', 'Organisation', 'Internal or external segment'],
  },
  {
    title: 'Context',
    fields: ['Bio', 'Associated project', 'Location', 'Expertise or stakeholder tags'],
  },
  {
    title: 'Relationship',
    fields: ['Relationship owner', 'Preferred channel', 'Source', 'Health / stage'],
  },
  {
    title: 'Activity',
    fields: ['Last interaction', 'Next follow-up', 'Notes and next step'],
  },
] as const

export const CRM_SPRINT_STREAMS = [
  'Shared contact model for internal users and external stakeholders',
  'Dedicated CRM persistence, CRUD, ownership, and reminders',
  'Privacy, consent, and external connector hardening before release',
] as const

const CRM_LIFECYCLE_SET = new Set(CRM_LIFECYCLE_OPTIONS.map((option) => option.value))
const CRM_CONSENT_SET = new Set(CRM_CONSENT_OPTIONS.map((option) => option.value))
const CRM_INTERACTION_SET = new Set(CRM_INTERACTION_OPTIONS.map((option) => option.value))

export function deriveRelationshipHealth(
  lastInteractionAt: string | null | undefined,
  now = new Date()
): CrmRelationshipHealth {
  if (!lastInteractionAt) return 'follow_up'
  const timestamp = new Date(lastInteractionAt)
  if (Number.isNaN(timestamp.getTime())) return 'follow_up'

  const ageInDays = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24))
  if (ageInDays <= 45) return 'active'
  if (ageInDays <= 120) return 'nurture'
  return 'follow_up'
}

export function getCrmHealthLabel(value: CrmRelationshipHealth) {
  if (value === 'active') return 'Active'
  if (value === 'nurture') return 'Nurture'
  if (value === 'archived') return 'Archived'
  return 'Follow-up'
}

export function getCrmSegmentLabel(value: CrmSegment) {
  return CRM_SEGMENT_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function getCrmConsentLabel(value: CrmConsentStatus) {
  return CRM_CONSENT_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function normalizeCrmLifecycle(value: string | null | undefined): CrmRelationshipHealth {
  return CRM_LIFECYCLE_SET.has(value as CrmRelationshipHealth) ? (value as CrmRelationshipHealth) : 'nurture'
}

export function normalizeCrmConsent(value: string | null | undefined): CrmConsentStatus {
  return CRM_CONSENT_SET.has(value as CrmConsentStatus) ? (value as CrmConsentStatus) : 'unknown'
}

export function normalizeCrmInteractionType(value: string | null | undefined): CrmInteractionType {
  return CRM_INTERACTION_SET.has(value as CrmInteractionType) ? (value as CrmInteractionType) : 'note'
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatCrmDate(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(timestamp)
}

export function normalizeProjectLabels(
  values: string[] | null | undefined,
  initiativeMap: Map<string, string>
) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => initiativeMap.get(value) ?? value)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export function matchesCrmQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

export function parseCrmList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export function formatCrmList(values: string[] | null | undefined) {
  return (values ?? []).join(', ')
}

// ─── Pipelines (funnels) ─────────────────────────────────────────────────────

export type CrmPipelineMember = {
  id: string
  contactId: string
  fullName: string
  pictureUrl: string | null
  title: string | null
  organisation: string | null
  segment: CrmSegment
  personType: CrmPersonType | null
  note: string | null
  position: number
}

export type CrmPipelineStage = {
  id: string
  name: string
  position: number
  members: CrmPipelineMember[]
}

export type CrmPipelineSummary = {
  id: string
  name: string
  description: string | null
  stageCount: number
  memberCount: number
  updatedAt: string
}

export type CrmPipelineDetail = CrmPipelineSummary & {
  stages: CrmPipelineStage[]
}
