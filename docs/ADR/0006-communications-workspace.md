# ADR-0006: Communications Workspace Module

- **Status:** accepted
- **Date:** 2026-05-17
- **Owners:** Michael Wittinger

## Context

The MVP pivot introduced a new communications workstream that is operationally distinct from the existing initiative, congress, and stories areas. The platform needs a dedicated place to manage:

- inbound content intake from manual and future automated channels
- a publishing calendar tied to initiatives and events
- event follow-up outputs
- World Campus session logging
- World Campus relationship tracking
- a small media asset library with publication-rights metadata

This workstream is intentionally narrower than a full CMS. It exists to support the MVP operating model quickly without coupling communications logic into unrelated modules.

- Related requirements: `REQ-COMMS-001`, `REQ-COMMS-002`, `REQ-COMMS-003`, `REQ-COMMS-004`, `REQ-COMMS-006`, `REQ-COMMS-007`, `REQ-COMMS-009`

## Decision

Create a dedicated **Communications Workspace** mounted at `/app/comms` and back it with six new tables:

1. `intake_items`
2. `content_calendar`
3. `events`
4. `campus_sessions`
5. `campus_members`
6. `media_assets`

### Access model

- `PlatformAdmin` has full access
- `Moderator` gains access only when `profiles.comms_team = true`
- all other roles are denied by default

This access rule is enforced in both the app layer and the database layer:

- app layer: middleware, auth callback redirect, and navigation gating
- database layer: RLS policies using `public.is_comms_team_or_admin()`

### UI shape

The module starts as a shell with five sub-routes:

- `/app/comms/intake`
- `/app/comms/calendar`
- `/app/comms/events`
- `/app/comms/campus-log`
- `/app/comms/media`

Sprint 01 ships these as placeholders so later sprints can add feature depth on top of a stable route and layout structure.

## Rationale

### Why a separate module instead of extending Stories

The communications workflow includes intake triage, scheduling, event operations, and media rights management. Those concerns are broader than story publishing and would make the stories surface harder to reason about if merged together.

### Why six tables instead of one generic content table

The MVP workstream already has distinct entities with different lifecycles:

- intake needs review and routing metadata
- calendar items need publishing state and upstream references
- events need operational stage tracking
- campus sessions and members model relationship history
- media assets need rights metadata and source links

Separate tables keep these lifecycles explicit and reduce ambiguous nullable fields.

### Why `comms_team` instead of a new platform role

Communications ownership is a scoped responsibility, not a new top-level user identity. Using a boolean flag on `profiles` allows a moderator cohort to operate the workspace without exploding the global role model.

## Alternatives Considered

1. Add communications features directly to `stories`
   Rejected because intake, calendar, and event operations are not story-only concerns.

2. Model communications as a set of initiative-specific features
   Rejected because communications needs to aggregate across initiatives, events, and World Campus activity.

3. Introduce a dedicated `CommunicationsManager` platform role
   Rejected for now because the existing role model can express the requirement with `Moderator + comms_team`.

## Consequences

### Positive

- Clear route ownership for future communications features
- Explicit schema boundaries for intake, publishing, events, campus, and media
- Safer access model with both UI gating and RLS enforcement
- Lower future migration cost because Sprint 01 establishes stable table names and route paths early

### Negative / Trade-offs

- Adds a new platform space that must stay synchronized across docs, middleware, nav, and permissions code
- Increases schema surface area before the feature depth is fully implemented
- Requires ongoing discipline to keep `comms_team` behavior aligned between app logic and RLS policies

## Rollout Plan

- Sprint 01: schema foundation, access gating, app shell, placeholder pages, tests, docs
- Sprint 02: intake workflow and content calendar behavior
- Sprint 03: events and World Campus log behavior
- Sprint 04: media workflow and pilot launch support

## References

- `supabase/migrations/00028_comms_intake_items.sql`
- `supabase/migrations/00029_comms_events.sql`
- `supabase/migrations/00030_comms_campus_sessions.sql`
- `supabase/migrations/00031_comms_media_assets.sql`
- `supabase/migrations/00032_comms_campus_members.sql`
- `supabase/migrations/00033_comms_content_calendar.sql`
- `supabase/migrations/00034_profiles_comms_team.sql`
- `supabase/migrations/00035_comms_permissions_rls.sql`
- `src/app/app/comms/layout.tsx`
- `src/lib/comms-access.ts`
- `docs/ROLE_PERMISSION_MODEL.md`
- `docs/TRACEABILITY.md`
