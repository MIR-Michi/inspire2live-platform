/**
 * feedback — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "feedback",
  version: '1.0.0',
  title: "Feedback",
  summary: "In-app feedback capture and the admin triage surface.",
  surface: "internal",
  data: {
    schema: "feedback",
    tables: ["feedback_items"],
  },
  provides: {
    api: ["submitFeedback", "loadFeedbackItems"],
    ui: ["FeedbackWidget", "FeedbackAdmin"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
  },
  featureFlag: null,
  personas: ["all"],
  roles: { read: ["admin"], write: ["authenticated"] },
  requirements: ["REQ-FEEDBACK-001"],
  operations: [],
})

export default manifest
