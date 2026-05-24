# Sprint 08 — Tasks

> Before implementing any Sprint 08 work, change the matching task row or rows to `In Progress`. If one delivery bundle covers several tasks, update all included rows together before making edits.

## Autonomous Parent Stream

`S08-AUTO` is the parent delivery stream for Sprint 08 tasks that can be implemented locally without external provider setup or live account ownership changes. These task rows are treated as ordered subtasks:

1. `S08-T01`
2. `S08-T02`
3. `S08-T03`
4. `S08-T04`
5. `S08-T05`
6. `S08-T06`
7. `S08-T07`
8. `S08-T08`
9. `S08-T09`
10. `S08-T10`
11. `S08-T11`
12. `S08-T12`
13. `S08-T13`
14. `S08-T14`

Execution rule for `S08-AUTO`: each subtask must be tested against its own acceptance criteria before moving to the next subtask. If acceptance criteria are still not met after 3 implementation-and-test attempts, record that explicitly in the subtask `Notes` and only then continue to the next subtask.

| ID | Task | Purpose / Scope | Acceptance Criteria | Owner | Status | Notes |
|---|---|---|---|---|---|---|
| S08-T01 | Add `profiles.user_type` and current user context support | Introduce workspace context without changing existing platform roles or comms RLS. | Migration adds `user_type` with `default`, `comms`, `board`, `partner`; `current_user_context()` exposes `role`, `user_type`, and `comms_team`; existing RLS remains valid. | Codex | Completed | Added migration `00042`; schema is additive and keeps existing comms RLS intact. |
| S08-T02 | Extend database/profile types and auth helpers | Make workspace context available to app code through typed helpers. | `UserType` and profile types include `user_type`; helpers expose `isCommsUser(profile)` and `getUserWorkspaceLabel(profile)` with `comms_team` fallback behavior. | Codex | Completed | Added typed workspace helpers plus database type updates; legacy `comms_team` remains a fallback. |
| S08-T03 | Implement user-type-aware side navigation | Give comms users a focused nav while preserving default nav unchanged. | Comms users see text-only Dashboard, Planner, Campus, Annual Congress, All events, Library sections; default users see the existing nav; active states and workspace label match the sprint description. | Codex | Completed | Comms nav is text-only; default nav path is preserved. |
| S08-T04 | Add comms unread badge source for Campus nav | Surface current-month unreviewed intake count in the comms nav. | Campus nav item shows a live count from `intake_items` where `status = 'unreviewed'` and captured in the relevant month; badge gracefully hides at zero. | Codex | Completed | Count is loaded server-side in app layout and hidden when zero. |
| S08-T05 | Add dashboard configuration system | Keep `/app/dashboard` shared while varying blocks by `user_type`. | `getDashboardConfig(userType)` returns default and comms configs; board and partner fall back to default; query identifiers are centralized. | Codex | Completed | Added `getDashboardConfig`; board and partner retain default dashboard composition. |
| S08-T06 | Refactor dashboard shell to consume config | Render dashboard stats, notifications, and panels from configuration. | Existing default dashboard behavior is preserved; comms dashboard renders configured stats, notification rows, and panels through a shared shell. | Codex | Completed | Default role dashboards are preserved; comms users see the shared dashboard with comms-specific blocks. |
| S08-T07 | Create Planner route from existing calendar workflow | Move the current content calendar into `/app/comms/planner` with the new Planner IA. | Planner route supports Calendar, List, Drafts, and My items views; month strip, calendar grid, in-progress cards, and create entry flow are available without breaking existing calendar data. | Codex | Completed | `/app/comms/planner` uses existing calendar records with Month, List, Drafts, and My items views; `/calendar` compatibility remains. |
| S08-T08 | Create Campus monthly meeting route | Reframe Campus Log around monthly meetings while keeping raw intake accessible. | `/app/comms/campus` lists monthly meeting cards; `/app/comms/campus/[year]/[month]` shows incoming content, briefing document, agenda/summary actions, decisions, and raw feed overlay. | Codex | Completed | Added monthly cards and read-only raw feed view; detailed operational workflow still needs human pilot review. |
| S08-T09 | Create Library route for routed content and media | Combine routed intake and media discovery into a searchable library. | `/app/comms/library` supports By event, By topic, People, and General tabs; search spans assets, keywords, and people; unreviewed items do not appear as library content. | Codex | Completed | Added searchable library over reviewed calendar content, media, events, and people; unreviewed intake stays in Intake. |
| S08-T10 | Extend Events section for I2L-organised vs networking events | Clarify internal event ownership and external attendance workflows. | Migration adds `events.is_i2l_organised`; `/app/comms/events` supports All, I2L own, Networking, Past tabs, event-type filters, separators, badges, and Annual Congress priority placement. | Codex | Completed | Added ownership field, filters, badges, create/edit support, and Annual Congress priority ordering. |
| S08-T11 | Verify Annual Congress access for comms users | Ensure comms workspace users can reach the existing Congress page. | Comms users can navigate to `/app/congress` without being redirected away; no Congress RLS broadening is required unless tests prove otherwise. | Codex | Completed | Comms nav links to `/app/congress`; no RLS broadening was introduced. |
| S08-T12 | Add shared New item modal skeleton | Provide a single item-creation entry point for Planner and Campus. | Modal supports Type, Content, Send, Attachments steps; WhatsApp group selection and attachment options are represented as local data only; no external send occurs. | Codex | Completed | Added local-only multi-step skeleton with placeholder groups and attachments; no provider calls. |
| S08-T13 | Add user management workspace assignment | Let PlatformAdmin assign `user_type` from the admin interface. | User management shows a Workspace column; PlatformAdmin can set Default, Comms, Board, or Partner through a server action; page revalidates after update. | Codex | Completed | Added PlatformAdmin-only server action and Workspace column while preserving role editing. |
| S08-T14 | Update route guard/default redirect behavior | Send comms users to the shared dashboard by default while keeping allowed routes accessible. | Auth callback or middleware reads `user_type`; comms default landing route is `/app/dashboard`; no broad redirect blocks access to permitted routes. | Codex | Completed | Middleware and callback read `user_type`; comms users land on `/app/dashboard` and retain comms route access. |
| S08-T15 | Add regression coverage and traceability updates | Protect the restructure from breaking existing default platform behavior. | Tests cover default nav, comms nav, dashboard config fallback, route guard behavior, Planner/Campus/Library route rendering, user-type update action, and core existing comms flows. Traceability rows document shipped scope and deferred provider work. | Codex | Completed | Added helper/config/route-guard tests and reran full unit, lint, typecheck, and build locally; human visual/workflow QC remains recommended. |

## Execution Bundles

| Bundle | Task IDs | Delivery description | Recommended model | Rationale | Intermediate QC | Human QC boundary |
|---|---|---|---|---|---|---|
| S08-B01 | S08-T01 to S08-T02 | Add the workspace-context foundation in schema, generated types, and auth helpers. | GPT-5 high | Profile shape, auth helpers, and role fallback logic are permission-sensitive. | Verify migration order, default values, helper fallbacks, typecheck, and RLS non-regression. | Autonomous. No external systems involved. |
| S08-B02 | S08-T03 to S08-T04 | Implement comms-specific navigation without changing default user navigation. | GPT-5 high | Shared layout changes can easily affect every authenticated user. | Compare default nav before/after, verify comms nav order, active states, workspace label, and count badge behavior. | Autonomous, with human visual review recommended before completion. |
| S08-B03 | S08-T05 to S08-T06 | Convert the dashboard to a configuration-driven shared shell. | GPT-5 high | Dashboard is central and must remain stable for default users while becoming user-type-aware. | Verify config lookup, query execution, default fallback, empty states, and existing dashboard data expectations. | Autonomous, with human visual review recommended before completion. |
| S08-B04 | S08-T07 to S08-T09 | Introduce Planner, Campus, and Library routes around existing comms data. | GPT-5 high | This is the largest IA change and touches daily comms workflows. | Verify old route compatibility, data filters, raw-feed read-only behavior, routed-only Library behavior, and mobile layout. | Autonomous for scaffolding and local behavior; human workflow review required before marking sprint complete. |
| S08-B05 | S08-T10 to S08-T11 | Extend events with I2L-organised/networking distinction and Congress access verification. | GPT-5 medium | Additive schema and UI filters are straightforward but must not confuse Annual Congress routing. | Verify migration, filters, separators, badges, Congress priority placement, and comms access to `/app/congress`. | Autonomous unless access policy changes are needed. |
| S08-B06 | S08-T12 | Add the shared New item modal skeleton with local-only distribution and attachment state. | GPT-5 medium | Multi-step modal UX has state complexity, but external sends stay out of scope. | Verify step state, selected groups, attachment rows, cancel/save behavior, and no external API call. | Human review required before any future live WhatsApp or SharePoint integration. |
| S08-B07 | S08-T13 to S08-T14 | Add admin assignment and redirect behavior for workspace user types. | GPT-5 high | Admin profile updates and auth redirects have broad blast radius. | Verify PlatformAdmin-only update behavior, default user redirect preservation, and comms default route. | Autonomous with local tests; human admin workflow review recommended. |
| S08-B08 | S08-T15 | Add regression coverage, traceability, and completion notes. | GPT-5 medium | Coverage should lock in the restructure without over-expanding scope. | Run lint, typecheck, unit tests, build, route smoke tests, and any focused E2E coverage. | Autonomous. Required before sprint completion. |

## Blocked / Deferred Dependencies

- Live WhatsApp distribution remains deferred until provider setup and human approval exist.
- SharePoint folder browsing remains deferred to the media graph sprint.
- Board and partner-specific workspace experiences remain placeholder fallback behavior.
- Real pilot workflow validation remains a human review step, not an autonomous coding task.
