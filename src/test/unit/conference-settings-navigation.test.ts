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
    expect(automation).toBeDefined()
    expect(automation?.items).toContainEqual(expect.objectContaining({
      id: 'conference-discovery',
      href: '/app/settings/conferences',
      planned: undefined,
    }))
  })
})
