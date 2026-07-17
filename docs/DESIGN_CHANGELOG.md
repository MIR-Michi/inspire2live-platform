# Design Changelog

## [WP7] Network, Board Dashboard, Newsfeed & Invite — 2026-02-20

### New Pages
- **`/app/network`** — My Network page (client component)
  - **Platform Members** tab: avatar grid with role badge, organisation, initiative memberships, activity dot
  - **External Partners** tab: partner org cards with type/relationship badges, linked initiatives, "Invite to Platform" button
  - **Invite modal** (preview): invite type selector (Platform / Initiative / Group), email, role, personal message; disabled Send button with "coming soon" notice
  - Search filter across both tabs
- **`/app/board`** — Board Management Dashboard (server component, role-gated to `BoardMember` + `PlatformAdmin`)
  - 6-card KPI strip: active initiatives, members, countries, milestones done, blocked tasks, at-risk count
  - Organisation-wide milestone progress bar
  - Portfolio health table with stage, lead, milestone bar chart, RAG status, last activity age
  - Organisation activity stream with typed event icons (milestone, initiative, member, ethics, partner, reporting)
  - Governance & compliance reminders panel with overdue flag
  - Non-board roles silently redirected to `/app/dashboard`

### Updated Pages
- **`/app/dashboard`** — All three role variants (Coordinator, Advocate, Board) now include a two-column bottom section:
  - **Notifications panel**: live DB notifications with DB→demo fallback; unread count badge; icon+colour by type; time-ago timestamps; "View all" link
  - **Field Newsfeed panel**: 6 curated cancer/advocacy/policy news items; category colour badges; source, region, date metadata; "non-live" indicator
- **`/app/initiatives/[id]/team`** — Converted to client component; added **"Invite to Initiative" button** and full invite modal (email, role, message fields); demo disclaimer banner preserved

### Navigation Updates (role-access.ts + side-nav.tsx)
- `NavKey` union extended with `'network'` and `'board'`
- All roles now include **My Network** (`/app/network`) in their nav
- `BoardMember` and `PlatformAdmin` receive **Board View** (`/app/board`) nav item
- Side-nav: new icons for Network (bidirectional arrows) and Board View (presentation chart)

### Demo Data (demo-data.ts)
- `DEMO_NEWSFEED` — 6 representative global oncology/advocacy/policy news items
- `DEMO_NETWORK_INTERNAL` — 8 platform member profiles (name, role, org, country, initiatives, last active)
- `DEMO_NETWORK_EXTERNAL` — 6 external partner organisations (type, contact, focus area, relationship status, linked initiatives)
- `DEMO_BOARD_ACTIVITY` — 7 org-level activity events for the board activity stream

### Engineering Notes
- `Date.now()` calls in server components replaced with `new Date().getTime()` captured once per render to satisfy Next.js purity linting rules
- Team page migrated from async server component to client component; auth guard remains in parent `layout.tsx`


## [WP6.2] — Initiative Workspace: Stage Clarity, Milestones Timeline, Evidence Hub, Team & Communication
**Date:** 2026-02-20

### Stage Vocabulary (global)
- Added canonical 5-stage vocabulary: **Idea → Planning → Execution → Public → Completed**
- Added `normalizeStage()` helper in `demo-data.ts` mapping DB `phase` values to canonical stages
- Added `STAGE_META` (label, color, description) and `STAGE_ORDER` constants
- Layout header now shows canonical stage badge with color (replaces raw `phase · status` text)
- Tab renamed: **Discussions → Communication**

### Milestones Tab (fixed + redesigned)
- **Bug fix**: Removed `onClick` handlers from server component (caused rendering failure)
- Replaced with full **project timeline view** grouped by initiative stage
- Stage Pipeline indicator shows current stage progress visually
- Summary stat grid (Total / Completed / In Progress / Overdue)
- Each milestone card: title, target date, completion date, evidence required badge, description, outcome
- Overdue detection at render time for DB milestones
- Rich demo content added (`DEMO_MILESTONES_RICH`, 8 items spanning planning → completion)

### Evidence Tab (rebuilt)
- Full **Evidence Hub** with category grouping: Regulatory, Clinical, Research, Policy, Patient Stories, Operational
- Status badges: Published / Reviewed / Draft
- File type icons, owner, date, version, linked milestone, description per item
- Category summary chips at top
- Rich demo content (`DEMO_EVIDENCE_RICH`, 8 items)

### Team Tab (enriched)
- Lead spotlight section with full bio, responsibilities, email, phone
- All members listed with: bio, responsibilities list, email link, phone, organization, activity indicator dot
- Role badges: Lead / Contributor / Reviewer / Observer
- Lead sorted first, then reviewers, then contributors
- Demo data: `DEMO_TEAM_MEMBERS_RICH` with full profiles for 5 members

### Overview Page (enhanced)
- **Core Team block** added with avatar chips, role badges, "View full team →" link to team tab
- Core team fetched from DB; falls back to demo rich members

### Communication Tab (new, replaces Discussions)
- Two-column layout: **Email Feed** + **Team Chat**
- Email feed: subject, from/to, type badge (Update / Action Required / Decision), preview, labels, reply count, unread indicator
- Compose email placeholder UI (non-functional)
- Team chat: avatar bubbles, timestamps, message body, emoji reactions, composer placeholder
- Integration placeholder note shown
- Demo content: `DEMO_EMAIL_THREADS` (4 realistic threads), `DEMO_TEAM_CHAT` (6 messages)


## [WP6.1] — Initiative Workspace Collaboration Features
**Date:** 2026-02-20

### Bug Fixes (P0)
- **`CreateInitiativeButton`** (`client-buttons.tsx`): Fixed critical bug where creating an initiative did not add the creator as a `lead` member in `initiative_members`, blocking workspace access. Now atomically inserts lead membership after initiative creation. Also fixed TypeScript type error (`description: null → undefined`). Button now redirects directly to the new initiative workspace rather than just refreshing the list.
- **`InitiativeOverviewPage`** (`initiatives/[id]/page.tsx`): Rewrote overview to safely handle missing lead/profile (no more runtime crash). Lead info is now sourced from the `initiative_health` view (already joined) with graceful null fallback.

### New Features (P1)
- **Collaboration Snapshot panel** (Overview): 4-stat grid showing Members / Open Tasks / Blocked Tasks / Milestones. Highlighted in red when blocked tasks > 0.
- **Initiative Health Panel** (Overview): Risk indicator badges (⚠ high / ⚡ medium / ✓ ok) for blocked tasks, overdue milestones, approaching milestones, and inactivity. Alert banner shown at top when high-risk items exist.
- **Milestone & Task Progress bars** (Overview): Live progress bars with percentage labels sourced from `initiative_health` view.
- **Contributor Workload Table** (Team tab): Full workload breakdown per member — Todo / In-Progress / Blocked / Overdue task counts, activity status dot (active/recent/inactive), sorted with leads first then by open task count.
- **Member Cards** (Team tab): Responsive mobile-friendly card grid with inline task load chips.
- **Tasks filter chips** (Tasks tab): One-click filters for All / ⛔ Blocked / ⚠ Overdue / ⏰ Due This Week / Unassigned with live counts. Disabled when count is 0.
- **Tasks grouping toggle** (Tasks tab): Switch between "By Status" and "By Assignee" grouping. Status order: blocked → in_progress → review → todo → done.
- New client component `TasksView` (`components/initiatives/tasks-view.tsx`) handles all filter/group interactivity.

### Architecture
- Tasks page is now split: server component (`tasks/page.tsx`) fetches and enriches data (overdue/dueThisWeek flags), passes to client `TasksView` for interactivity.
- `DEMO_INITIATIVE_IDS` exported from `demo-data.ts` for consistent demo ID lookups across tabs.


Tracks meaningful interpretation/changes from the benchmark design document that affect implementation.

## 2026-02-19

### Added
- Execution-layer governance docs (`IMPLEMENTATION_GUIDE`, `TRACEABILITY`, ADR template, PR template).

### Clarified
- Design document remains benchmark/source-of-truth.
- Engineering executes from implementation-layer artifacts to reduce reread overhead.
- Platform positioning is complementary to the existing public website (`www.inspire2live.com`), not a replacement.

### Technical adjustment
- Resource full-text search implemented with **trigger-based `fts` update** instead of generated column expression due to PostgreSQL immutability constraint encountered during migration push.

## 2026-07-17 — Adaptive dashboard composition

**Decision:** Replace independent stacked dashboard layouts with one component-library-first adaptive composition contract. Desktop uses a resizable primary/supporting workspace; mobile retains logical primary-first order. Personal changes require explicit edit mode and persist across devices.

**Interaction:** Move/resize/hide/restore/presets/undo/reset are available only in edit mode. Required governance widgets remain visible. View-as is read-only.

**Visual system:** Organization defaults for density, semantic radius, elevation, motion, task celebration, preset, and split ratio are edited in Platform Settings → Design & Component Library and preview the real production components.

**Motion:** Task completion celebrates only after successful direct persistence. Reduced-motion users receive static success feedback and announcements without particles.

**References:** ADR-0012, `docs/ADAPTIVE_DASHBOARD_WIREFRAME_SPEC.md`, PR #181.

---

*Last reviewed: 2026-07-17.*
