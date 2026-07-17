/**
 * kernel/settings/kernel-panels.ts
 *
 * Fixed, kernel-owned settings panels (ADR-0010). Components declare their
 * panels through manifests; the kernel declares organization-wide identity and
 * design defaults here using the same typed field vocabulary.
 */

import type { SettingsPanel } from '@/kernel/settings/types'

export const organizationPanel: SettingsPanel = {
  id: 'kernel:organization',
  scope: 'kernel',
  componentId: null,
  title: 'Organization Profile & Brand',
  description:
    'Platform identity used across the app and, later, carried in the platform blueprint. ' +
    'Overrides the NEXT_PUBLIC_APP_NAME bootstrap value once set.',
  fields: [
    {
      key: 'displayName',
      type: 'string',
      label: 'Display name',
      description: 'Shown in the top bar, emails, and the browser title.',
      default: 'Inspire2Live Platform',
    },
    {
      key: 'supportEmail',
      type: 'email',
      label: 'Support / contact email',
      description: 'Where platform-level questions and notices are directed.',
      default: '',
    },
    {
      key: 'brandColor',
      type: 'color',
      label: 'Accent colour',
      description: 'Primary accent used for highlights and calls to action.',
      default: '#ea580c',
    },
    {
      key: 'timezone',
      type: 'string',
      label: 'Default timezone',
      description: 'IANA timezone used when a user has no preference (e.g. Europe/Amsterdam).',
      default: 'Europe/Amsterdam',
    },
    {
      key: 'locale',
      type: 'enum',
      label: 'Default locale',
      description: 'Interface language / regional formatting default.',
      options: ['en', 'nl', 'de'],
      default: 'en',
    },
  ],
}

/**
 * Organization-wide design defaults. Personal dashboard arrangements remain
 * user-owned; this panel only controls the validated defaults and semantic
 * component-library variants used when a user has not customized a surface.
 */
export const designSystemPanel: SettingsPanel = {
  id: 'kernel:design-system',
  scope: 'kernel',
  componentId: null,
  title: 'Design & Component Library',
  description:
    'Organization-wide semantic design defaults and dashboard starting points. ' +
    'Individual users can still personalize their own dashboard arrangement.',
  fields: [
    {
      key: 'dashboardDensity',
      type: 'enum',
      label: 'Default dashboard density',
      description: 'Comfortable provides more breathing room; compact fits more operational content.',
      options: ['comfortable', 'compact'],
      default: 'comfortable',
    },
    {
      key: 'radiusStyle',
      type: 'enum',
      label: 'Card corner style',
      description: 'Semantic radius profile used by new component-library surfaces.',
      options: ['crisp', 'rounded', 'soft'],
      default: 'rounded',
    },
    {
      key: 'elevationStyle',
      type: 'enum',
      label: 'Card elevation',
      description: 'Controls the default separation between tiles and the page surface.',
      options: ['minimal', 'subtle', 'layered'],
      default: 'subtle',
    },
    {
      key: 'motionProfile',
      type: 'enum',
      label: 'Motion profile',
      description: 'Controls the pace of purposeful interface transitions.',
      options: ['calm', 'balanced', 'expressive'],
      default: 'balanced',
    },
    {
      key: 'taskCelebration',
      type: 'boolean',
      label: 'Task completion celebration',
      description: 'Show a brief localized confetti acknowledgement after a deliberate task completion.',
      default: true,
    },
    {
      key: 'dashboardDefaultPreset',
      type: 'enum',
      label: 'Default dashboard preset',
      description: 'Starting composition for users who have not customized a dashboard.',
      options: ['balanced', 'focus', 'overview'],
      default: 'balanced',
    },
    {
      key: 'dashboardDefaultSplitRatio',
      type: 'number',
      label: 'Default primary-column share',
      description: 'Primary column width as a decimal share of the desktop dashboard.',
      min: 0.42,
      max: 0.78,
      step: 0.01,
      default: 0.64,
    },
  ],
}

/** Every kernel-owned settings panel, in display order. */
export const kernelPanels: SettingsPanel[] = [organizationPanel, designSystemPanel]
