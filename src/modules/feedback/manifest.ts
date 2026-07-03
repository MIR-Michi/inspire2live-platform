/**
 * feedback — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Fully converted (S16-T05): the reference component. domain/ui/api live under
 * src/modules/feedback and are exposed via index.ts; the `provides` below match
 * that public API exactly.
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
    api: [
      "createFeedbackItem",
      "updateFeedbackStatus",
      "deleteFeedbackItem",
      "loadFeedbackItems",
      "loadFeedbackStatusCounts",
      "requireFeedbackAdmin",
      "handleFeedbackExport",
    ],
    ui: ["FeedbackOverlay", "FeedbackItemsList", "TestModeProvider"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "data"],
  },
  featureFlag: null,
  personas: ["all"],
  roles: { read: ["admin"], write: ["authenticated"] },
  requirements: ["REQ-FEEDBACK-001"],
  operations: [],
})

export default manifest
