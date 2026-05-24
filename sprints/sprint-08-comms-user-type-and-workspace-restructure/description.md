# Sprint 08 — Comms User Type & Workspace Restructure

**Phase:** 2 planning backlog
**Status:** Local implementation complete; pending human visual/workflow QC

## Goal

Introduce a dedicated `comms` user type and restructure the Communications workspace around the daily workflows of the comms team, without disrupting the existing data model, RLS posture, or non-comms platform navigation.

## Rationale

The Communications Workspace is operational, but comms users still see the broad platform navigation and the older five-tab comms information architecture. This sprint separates workspace context from platform role: comms users get a focused navigation, dashboard composition, and route structure while the existing platform experience remains available to default users.

The sprint is intentionally additive and compatibility-first. Existing tables such as `intake_items`, `content_calendar`, `events`, `campus_sessions`, `campus_members`, and `media_assets` remain in place. Existing RLS policies remain authoritative.

## Safety guardrails

- Do not remove or rename existing routes until replacement routes are live and verified.
- Keep default-user navigation and dashboard behavior unchanged.
- Keep provider-dependent integration behavior out of scope.
- Preserve existing communications data tables and RLS policies.
- Add compatibility redirects or links where route names change, especially Calendar to Planner, Campus Log to Campus, and Media/Intake to Library.
- No Sprint 07 media graph work starts as part of this sprint.

## Acceptance criteria

- Profiles support a `user_type` workspace context with `default`, `comms`, `board`, and `partner` values.
- TypeScript profile types and auth helpers expose `user_type`, `isCommsUser`, and workspace labels.
- Comms users see a focused text-only nav with Dashboard, Planner, Campus, Annual Congress, All events, and Library.
- Default users keep the existing platform navigation unchanged.
- `/app/dashboard` uses a shared dashboard configuration system instead of separate user-type pages.
- `/app/comms/planner` carries the current calendar workflow forward with the new Planner IA.
- `/app/comms/campus` introduces the monthly meeting container without destroying the raw intake workflow.
- `/app/comms/library` combines routed intake and media discovery without exposing unreviewed items as library content.
- `/app/comms/events` supports I2L-organised vs networking event distinctions while keeping Annual Congress structurally distinct.
- User management can assign the workspace user type.
- Auth redirects send comms users to `/app/dashboard` while still respecting route permissions.
- Regression coverage protects default navigation, comms navigation, dashboard config, route access, and core comms workflows.

## Out of scope

- Live WordPress, LinkedIn, newsletter, SharePoint, Teams, or WhatsApp send integrations.
- Board and partner-specific dashboard implementations beyond placeholder config fallback.
- Replacing RLS policies for existing comms tables.
- Sprint 04 pilot operations that require real users or human workshop activity.
- Sprint 07 media graph implementation.
