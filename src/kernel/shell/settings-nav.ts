/**
 * kernel/shell/settings-nav.ts
 *
 * The section sub-nav for the Platform Settings space (ADR-0010 §4). Sections map
 * 1:1 to the ADR-0009 kernel/component split: *Access & Identity*, *Organization*,
 * and *Observability & Review* are kernel surfaces; *Capabilities* and
 * *Integrations* are component surfaces. Existing admin pages keep their
 * `/app/admin/*` URLs and are unified into this tree; new panels live under
 * `/app/settings/*`. All routes are PlatformAdmin-gated.
 *
 * Feedback is intentionally KEPT IN, under *Observability & Review* (ADR-0010 §2)
 * — an admin monitoring/review surface, not moved out to its component.
 */

import type { NavIcon } from '@/kernel/rbac/role-access'

export type SettingsNavItem = {
  id: string
  label: string
  href: string
  icon: NavIcon
  /** Marks a not-yet-built backlog panel (rendered disabled). */
  planned?: boolean
}

export type SettingsNavSection = {
  label: string
  items: SettingsNavItem[]
}

export const SETTINGS_SECTIONS: SettingsNavSection[] = [
  {
    label: 'Access & Identity',
    items: [
      { id: 'users',       label: 'Users',               href: '/app/admin/users',       icon: 'admin' },
      { id: 'permissions', label: 'Roles & Permissions', href: '/app/admin/permissions', icon: 'board' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'organization', label: 'Profile & Brand', href: '/app/settings/organization', icon: 'settings' },
    ],
  },
  {
    label: 'Capabilities',
    items: [
      { id: 'modules', label: 'Modules', href: '/app/settings/capabilities', icon: 'initiatives' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'ai',       label: 'AI / Claude',        href: '/app/admin/ai',                    icon: 'settings' },
      { id: 'org-feed', label: 'Organization Feed',  href: '/app/admin/org-feed',              icon: 'network' },
      { id: 'intake',   label: 'Channel Intake',     href: '/app/settings/components/intake',  icon: 'whatsapp' },
      { id: 'whatsapp', label: 'WhatsApp',           href: '/app/settings/capabilities',       icon: 'whatsapp', planned: true },
      { id: 'email',    label: 'Email (Resend)',     href: '/app/settings/capabilities',       icon: 'feedback', planned: true },
    ],
  },
  {
    label: 'Observability & Review',
    items: [
      { id: 'activity', label: 'User Activity', href: '/app/admin/activity', icon: 'dashboard' },
      { id: 'feedback', label: 'Feedback',      href: '/app/admin/feedback', icon: 'feedback' },
    ],
  },
]
