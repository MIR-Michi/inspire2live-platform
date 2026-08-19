/**
 * content — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "content",
  version: '1.0.0',
  title: "Content & Media",
  // Reworded in Sprint 21 so "publishing" is unambiguous: `content` owns the
  // editorial calendar, the media library and the integration-intent log — the
  // *destination* for approved copy. Composing copy and gating its approval is
  // the `publishing` component (ADR-0014).
  summary: "Editorial content calendar, media library and the outbound integration-intent log — the destination approved content lands in.",
  surface: "internal",
  data: {
    schema: "content",
    tables: ["content_calendar", "media_assets", "media_recovery_offers", "media_recovery_requests", "comms_integration_intents", "comms_digest_runs"],
  },
  provides: {
    api: ["loadContentCalendar", "loadMediaLibrary", "createCalendarEntry", "logIntegrationIntent"],
    ui: ["ContentCalendar", "MediaLibrary"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
    components: ["intake@^1", "events@^1"],
  },
  featureFlag: "comms_team",
  personas: ["communications-coordinator"],
  roles: { read: ["comms_team", "admin"], write: ["comms_team", "admin"] },
  requirements: ["REQ-COMMS-CONTENT-001"],
  operations: [],
})

export default manifest
