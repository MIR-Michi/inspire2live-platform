import { describe, expect, it } from 'vitest'
import { SETTINGS_SECTIONS } from '@/kernel/shell/settings-nav'
import { componentSettingsHref, findSettingsPanel } from '@/modules/settings-registry'

describe('conference settings navigation', () => {
  it('gives the events panel a first-class conference settings route', () => {
    expect(findSettingsPanel('component:events')).toBeDefined()
    expect(componentSettingsHref('events')).toBe('/app/settings/conferences')
  })

  it('exposes conference discovery in the Automation settings section', () => {
    const automation = SETTINGS_SECTIONS.find((section) => section.label === 'Automation')
    const item = automation?.items.find((entry) => entry.id === 'conference-discovery')

    expect(automation).toBeDefined()
    expect(item).toMatchObject({ href: '/app/settings/conferences' })
    expect(item?.planned).not.toBe(true)
  })
})
