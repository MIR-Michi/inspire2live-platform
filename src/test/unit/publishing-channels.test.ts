import { describe, expect, it } from 'vitest'
import {
  CHANNEL_PROFILES,
  channelBudget,
  channelProfile,
  isChannelEnabled,
} from '@/modules/publishing/domain/channels'

describe('channel profiles (a channel is data, ADR-0014 §5)', () => {
  it('LinkedIn is the one enabled channel in Sprint 21', () => {
    expect(isChannelEnabled('linkedin')).toBe(true)
    expect(isChannelEnabled('newsletter')).toBe(false)
    expect(isChannelEnabled('wordpress')).toBe(false)
  })

  it('newsletter and website are declared (visible, not available)', () => {
    expect(channelProfile('newsletter')?.availability).toBe('declared')
    expect(channelProfile('wordpress')?.availability).toBe('declared')
  })

  it('uses the existing CalendarChannel vocabulary — website IS wordpress', () => {
    const channels = CHANNEL_PROFILES.map((profile) => profile.channel)
    expect(channels).toEqual(['linkedin', 'newsletter', 'wordpress'])
    expect(channels).not.toContain('website')
  })

  it('channelBudget returns the profile budget, and 0 for unknown channels', () => {
    expect(channelBudget('linkedin')).toBe(1300)
    expect(channelBudget('podcast')).toBe(0)
    expect(channelBudget('tiktok')).toBe(0)
  })

  it('the LinkedIn profile forbids markdown and allows at most one link', () => {
    const linkedin = channelProfile('linkedin')
    expect(linkedin?.markdownAllowed).toBe(false)
    expect(linkedin?.maxLinks).toBe(1)
  })
})
