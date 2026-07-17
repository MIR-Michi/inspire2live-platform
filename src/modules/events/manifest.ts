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
    tables: ["events", "conferences", "conference_contact_assignments", "conference_discovery_status", "conference_prep", "conference_tracking", "conference_guest_tokens", "conference_guest_access_requests", "conference_guest_files", "conference_guest_notes", "conference_guest_submissions", "conference_guest_invites", "campus_sessions", "session_attendees", "world_campus_sessions", "hubs", "comms_weekly_agenda_items", "congress_events", "congress_assignments", "congress_members", "congress_activity_log"],
  },
  provides: {
    api: ["loadEventPipeline", "loadConference"],
    ui: ["EventsPipelineShell"],
    settingsPanel: true,
  },
  // Operator-tunable conference-discovery settings, rendered as a panel in the
  // Platform Settings space (ADR-0010 §5). Resolver precedence: these defaults
  // → platform_settings → env. Read by the discovery route/cron.
  config: {
    discoveryEnabled: {
      type: "boolean",
      label: "Automatic conference discovery",
      description: "Let the scheduled job search the web for new conferences and refresh the list.",
      default: true,
    },
    discoveryIntervalDays: {
      type: "number",
      label: "Minimum days between searches",
      description: "The scheduled job runs at most this often (it is triggered daily but skips until this interval has elapsed since the last successful refresh).",
      default: 7,
      min: 1,
      max: 90,
      step: 1,
    },
    discoveryMonthsAhead: {
      type: "number",
      label: "Look-ahead window (months)",
      description: "Only collect conferences whose start date falls within this many months.",
      default: 12,
      min: 1,
      max: 36,
      step: 1,
    },
    discoveryMaxSearchesPerLane: {
      type: "number",
      label: "Max web searches per lane",
      description: "Token/cost budget: how many web searches each discovery lane may run.",
      default: 4,
      min: 1,
      max: 10,
      step: 1,
    },
    discoveryMaxLanesPerRegion: {
      type: "number",
      label: "Source lenses per region",
      description: "Breadth vs cost: how many source lenses to search per region (max 6).",
      default: 6,
      min: 1,
      max: 6,
      step: 1,
    },
    discoveryExistingNamesCap: {
      type: "number",
      label: "Known-conference hint size",
      description: "How many existing conference names to send the model as a “do not repeat” hint.",
      default: 50,
      min: 1,
      max: 300,
      step: 1,
    },
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
