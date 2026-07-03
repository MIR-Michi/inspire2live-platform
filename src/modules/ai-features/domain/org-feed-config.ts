/**
 * lib/ai/org-feed-config.ts
 *
 * Pure parsing + validation helpers for the organization news-feed config
 * (Sprint 14 Capability 4). Kept free of server-only imports so the admin UI,
 * the generation job, and unit tests can all share the same rules.
 */

export type OrgFeedCadence = 'daily' | 'weekly' | 'monthly'

export type OrgNewsfeedRunState = 'idle' | 'running' | 'success' | 'error'

export type OrgNewsfeedRunStatus = {
  status: OrgNewsfeedRunState
  message: string | null
  startedAt: string | null
  finishedAt: string | null
  inserted: number | null
}

export type OrgFeedConfig = {
  topics: string[]
  themes: string[]
  allowedSources: string[]
  blockedSources: string[]
  region: string | null
  cadence: OrgFeedCadence
  enabled: boolean
  // Mention monitoring.
  watchOrganization: boolean
  organizationAliases: string[]
  watchCrmInternal: boolean
  watchPeople: string[]
}

export const ORG_FEED_CADENCES: OrgFeedCadence[] = ['daily', 'weekly', 'monthly']

export const DEFAULT_ORGANIZATION_ALIAS = 'Inspire2Live'

export const DEFAULT_ORG_FEED_CONFIG: OrgFeedConfig = {
  topics: [],
  themes: [],
  allowedSources: [],
  blockedSources: [],
  region: null,
  cadence: 'weekly',
  enabled: true,
  watchOrganization: true,
  organizationAliases: [DEFAULT_ORGANIZATION_ALIAS],
  watchCrmInternal: false,
  watchPeople: [],
}

const MAX_LIST_ITEMS = 50

/** Parse a newline/comma-separated textarea value into a clean, de-duped list. */
export function parseList(raw: string | null | undefined, maxLen = 120): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n,]/)) {
    const value = part.trim().replace(/\s+/g, ' ').slice(0, maxLen)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= MAX_LIST_ITEMS) break
  }
  return out
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

/**
 * Normalize a source entry to a bare domain (strips scheme, path, www, port).
 * Returns null when the value isn't a plausible domain.
 */
export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '')
  value = value.split('/')[0]?.split('?')[0]?.split('#')[0] ?? ''
  value = value.split(':')[0] // drop port
  if (!value || value.length > 253) return null
  return DOMAIN_RE.test(value) ? value : null
}

export function parseDomainList(raw: string | null | undefined): { domains: string[]; invalid: string[] } {
  const domains: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const entry of parseList(raw, 253)) {
    const domain = normalizeDomain(entry)
    if (!domain) {
      invalid.push(entry)
      continue
    }
    if (seen.has(domain)) continue
    seen.add(domain)
    domains.push(domain)
  }
  return { domains, invalid }
}

export function normalizeCadence(value: string | null | undefined): OrgFeedCadence {
  return ORG_FEED_CADENCES.includes(value as OrgFeedCadence) ? (value as OrgFeedCadence) : 'weekly'
}

export type OrgFeedConfigValidation =
  | { ok: true; config: OrgFeedConfig }
  | { ok: false; errors: string[] }

/**
 * Validate a raw config form into a clean OrgFeedConfig, or a list of errors.
 */
export function validateOrgFeedConfig(input: {
  topics?: string | null
  themes?: string | null
  allowedSources?: string | null
  blockedSources?: string | null
  region?: string | null
  cadence?: string | null
  enabled?: boolean
  watchOrganization?: boolean
  organizationAliases?: string | null
  watchCrmInternal?: boolean
  watchPeople?: string | null
}): OrgFeedConfigValidation {
  const errors: string[] = []

  const topics = parseList(input.topics)
  const themes = parseList(input.themes)
  const allowed = parseDomainList(input.allowedSources)
  const blocked = parseDomainList(input.blockedSources)
  const watchPeople = parseList(input.watchPeople)
  const watchOrganization = input.watchOrganization ?? false
  const watchCrmInternal = input.watchCrmInternal ?? false

  // Default the org alias when monitoring the org but no alias was given.
  let organizationAliases = parseList(input.organizationAliases)
  if (watchOrganization && organizationAliases.length === 0) organizationAliases = [DEFAULT_ORGANIZATION_ALIAS]

  if (allowed.invalid.length > 0) errors.push(`Invalid allowed source domains: ${allowed.invalid.join(', ')}`)
  if (blocked.invalid.length > 0) errors.push(`Invalid blocked source domains: ${blocked.invalid.join(', ')}`)

  // The feed has something to do if it has a topic/theme OR is monitoring
  // the organization, CRM-internal people, or named individuals.
  const hasContent =
    topics.length > 0 || themes.length > 0 || watchOrganization || watchCrmInternal || watchPeople.length > 0
  if (input.enabled && !hasContent) {
    errors.push('Add at least one topic, theme, or mention to monitor before enabling the feed.')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    config: {
      topics,
      themes,
      allowedSources: allowed.domains,
      blockedSources: blocked.domains,
      region: input.region?.trim() ? input.region.trim().slice(0, 120) : null,
      cadence: normalizeCadence(input.cadence),
      enabled: input.enabled ?? true,
      watchOrganization,
      organizationAliases,
      watchCrmInternal,
      watchPeople,
    },
  }
}
