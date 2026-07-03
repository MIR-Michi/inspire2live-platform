/**
 * stories — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "stories",
  version: '1.0.0',
  title: "Patient Stories",
  summary: "The public patient-stories site (read-only, SEO-facing) and its moderation trail.",
  surface: "public",
  data: {
    schema: "stories",
    tables: ["patient_stories", "patient_story_events", "story_status_changes"],
  },
  provides: {
    api: ["loadPublishedStories", "loadStoryBySlug"],
    ui: ["StoriesIndex", "StoryDetail"],
  },
  dependsOn: {
    kernel: ["identity"],
  },
  featureFlag: null,
  personas: ["patient-advocate", "public"],
  roles: { read: ["public"], write: ["moderator", "admin"] },
  requirements: ["REQ-STORIES-001"],
  operations: [],
})

export default manifest
