import { describe, expect, it } from 'vitest'

import {
  normalizeDomain,
  parseDomainList,
  parseList,
  normalizeCadence,
  validateOrgFeedConfig,
} from '@/lib/ai/org-feed-config'

describe('parseList', () => {
  it('splits on newlines and commas, trims, and de-dupes', () => {
    expect(parseList('precision oncology\nimmunotherapy, immunotherapy\n  ')).toEqual(['precision oncology', 'immunotherapy'])
  })
  it('returns empty for blank input', () => {
    expect(parseList('')).toEqual([])
    expect(parseList(null)).toEqual([])
  })
})

describe('normalizeDomain', () => {
  it('strips scheme, www, path, and port', () => {
    expect(normalizeDomain('https://www.nature.com/articles/x?y=1')).toBe('nature.com')
    expect(normalizeDomain('WHO.int:443/news')).toBe('who.int')
  })
  it('rejects non-domains', () => {
    expect(normalizeDomain('not a domain')).toBeNull()
    expect(normalizeDomain('localhost')).toBeNull()
    expect(normalizeDomain('')).toBeNull()
  })
})

describe('parseDomainList', () => {
  it('separates valid domains from invalid entries', () => {
    const result = parseDomainList('nature.com\nhttps://who.int\nbogus entry')
    expect(result.domains).toEqual(['nature.com', 'who.int'])
    expect(result.invalid).toEqual(['bogus entry'])
  })
})

describe('normalizeCadence', () => {
  it('accepts known cadences and falls back to weekly', () => {
    expect(normalizeCadence('daily')).toBe('daily')
    expect(normalizeCadence('monthly')).toBe('monthly')
    expect(normalizeCadence('hourly')).toBe('weekly')
    expect(normalizeCadence(null)).toBe('weekly')
  })
})

describe('validateOrgFeedConfig', () => {
  it('builds a clean config from raw form input', () => {
    const result = validateOrgFeedConfig({
      topics: 'precision oncology\nclinical trials',
      themes: 'patient advocacy',
      allowedSources: 'nature.com',
      blockedSources: '',
      region: '  Europe  ',
      cadence: 'daily',
      enabled: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config).toMatchObject({
        topics: ['precision oncology', 'clinical trials'],
        themes: ['patient advocacy'],
        allowedSources: ['nature.com'],
        region: 'Europe',
        cadence: 'daily',
        enabled: true,
      })
    }
  })

  it('rejects invalid domains', () => {
    const result = validateOrgFeedConfig({ allowedSources: 'not a domain', topics: 'x', enabled: true })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('Invalid allowed source domains')
  })

  it('requires a topic, theme, or mention when enabling the feed', () => {
    const result = validateOrgFeedConfig({ topics: '', themes: '', enabled: true })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain('at least one topic, theme, or mention')
  })

  it('accepts an enabled feed with only mention monitoring', () => {
    const result = validateOrgFeedConfig({ topics: '', themes: '', enabled: true, watchOrganization: true })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config.watchOrganization).toBe(true)
      // Defaults the org alias when monitoring the org without one.
      expect(result.config.organizationAliases).toEqual(['Inspire2Live'])
    }
  })

  it('parses watched people and CRM-internal flag', () => {
    const result = validateOrgFeedConfig({
      topics: 'x',
      enabled: true,
      watchCrmInternal: true,
      watchPeople: 'Peter Kapitein\nJane Doe',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config.watchCrmInternal).toBe(true)
      expect(result.config.watchPeople).toEqual(['Peter Kapitein', 'Jane Doe'])
    }
  })

  it('allows an empty disabled config', () => {
    const result = validateOrgFeedConfig({ topics: '', themes: '', enabled: false })
    expect(result.ok).toBe(true)
  })
})
