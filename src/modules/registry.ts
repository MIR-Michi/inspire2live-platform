/**
 * modules/registry.ts
 *
 * The component catalog: every module's manifest in one place. This is the
 * artifact the governance CI checks reconcile against today, and the same
 * catalog the L1 wizard / L2 generator read later (see ADR-0009).
 *
 * When a new component is added, import its manifest here.
 */

import type { ComponentManifest } from '@/kernel/manifest'

import { manifest as contacts } from '@/modules/contacts/manifest'
import { manifest as intake } from '@/modules/intake/manifest'
import { manifest as content } from '@/modules/content/manifest'
import { manifest as events } from '@/modules/events/manifest'
import { manifest as initiatives } from '@/modules/initiatives/manifest'
import { manifest as tasks } from '@/modules/tasks/manifest'
import { manifest as onboarding } from '@/modules/onboarding/manifest'
import { manifest as stories } from '@/modules/stories/manifest'
import { manifest as feedback } from '@/modules/feedback/manifest'
import { manifest as aiFeatures } from '@/modules/ai-features/manifest'

export const componentManifests: ComponentManifest[] = [
  contacts,
  intake,
  content,
  events,
  initiatives,
  tasks,
  onboarding,
  stories,
  feedback,
  aiFeatures,
]
