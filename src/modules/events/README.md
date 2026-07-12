# Events & Conferences (`events`)

Event pipeline: conferences, podcast, World Campus sessions and the congress guest-attend flow.

- **Surface:** internal
- **DB schema (target):** `events`
- **Owns tables:** `events`, `conferences`, `conference_contact_assignments`, `conference_discovery_status`, `conference_prep`, `conference_tracking`, `conference_guest_tokens`, `conference_guest_access_requests`, `conference_guest_files`, `conference_guest_notes`, `conference_guest_submissions`, `campus_sessions`, `session_attendees`, `world_campus_sessions`, `comms_weekly_agenda_items`, `congress_events`, `congress_assignments`, `congress_members`, `congress_activity_log`
- **Depends on:** kernel [identity, rbac, notifications, ai-client] · components [contacts@^1]
- **Feature flag:** `comms_team`
- **Requirements:** REQ-COMMS-EVENTS-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.

> **Boundary note:** Heterogeneous by history (conferences / podcast / campus / congress guest-attend). Manifest authoring is expected to reveal an internal split — see the concept §8.
