/**
 * ai-features — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "ai-features",
  version: '1.0.0',
  title: "AI Features",
  summary: "AI-enriched capabilities: org news feed, meeting summaries/transcripts, and AI settings/usage.",
  surface: "internal",
  data: {
    schema: "ai_features",
    tables: ["ai_settings", "ai_usage_log", "org_feed_config", "news_feed_items", "meeting_summaries", "meeting_transcripts"],
  },
  provides: {
    api: ["loadOrgFeed", "summarizeMeeting"],
    ui: ["OrgNewsFeed", "AiSettings"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "ai-client", "notifications"],
    components: ["intake@^1", "events@^1", "contacts@^1"],
  },
  featureFlag: "ai",
  personas: ["communications-coordinator", "platform-admin"],
  roles: { read: ["authenticated"], write: ["admin"] },
  requirements: ["REQ-AI-001"],
  operations: ["org-newsfeed-run", "meeting-summary", "net-monitoring"],
})

export default manifest
