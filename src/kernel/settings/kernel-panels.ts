/**
 * kernel/settings/kernel-panels.ts
 *
 * The fixed, kernel-owned settings panels (ADR-0010 §4 — the *kernel* half of
 * the settings tree). Components declare their panels through their manifest
 * `config`; the kernel declares its panels here, in the exact same field
 * vocabulary, so the settings shell renders both identically.
 *
 * Adding a field here surfaces a control in the Platform Settings space with no
 * bespoke form code — the same property component panels have.
 */

import type { SettingsPanel } from '@/kernel/settings/types'

/**
 * Organization / Brand — the platform's identity. Today the app name lives in
 * `NEXT_PUBLIC_APP_NAME` (env, redeploy to change); these settings move it (and
 * the rest of the brand) into the DB so an operator can tune it live and so it
 * becomes the `brand` block of a generated-platform blueprint (ADR-0009 §11).
 */
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

/** Every kernel-owned settings panel, in display order. */
export const kernelPanels: SettingsPanel[] = [organizationPanel]
