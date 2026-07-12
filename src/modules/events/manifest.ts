/**
 * events — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 *
 * NOTE: Heterogeneous by history (conferences / podcast / campus / congress guest-attend). Manifest authoring is expected to reveal an internal split — see the concept §8.
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "events",
  version: '1.0.0',
  title: "Events & Conferences",
  summary: "Event pipeline: conferences, podcast, World Campus sessions and the congress guest-attend flow.",
  surface: "internal",
  data: {
    schema: "events",
    tables: ["events", "conferences", "conference_contact_assignments", "conference_discovery_status", "conference_prep", "conference_tracking", "conference_guest_tokens", "conference_guest_access_requests", "conference_guest_files", "conference_guest_notes", "conference_guest_submissions", "campus_sessions", "session_attendees", "world_campus_sessions", "hubs", "comms_weekly_agenda_items", "congress_events", "congress_assignments", "congress_members", "congress_activity_log"],
  },
  provides: {
    api: ["loadEventPipeline", "loadConference"],
    ui: ["EventsPipelineShell"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications", "ai-client"],
    components: ["contacts@^1"],
  },
  featureFlag: "comms_team",
  personas: ["communications-coordinator"],
  roles: { read: ["comms_team", "admin"], write: ["comms_team", "admin"] },
  requirements: ["REQ-COMMS-EVENTS-001"],
  operations: ["campus-briefing"],
})

export default manifest
