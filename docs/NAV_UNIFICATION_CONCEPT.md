# Concept: Unified Navigation — One Menu Tree, Permission-Driven Views

**Status:** Concept (not implemented)
**Date:** 2026-06-11
**Supersedes:** the per-role menu trees (`NAV_SECTIONS_BY_ROLE`) introduced on branch `claude/sweet-bell-25l6lv`

## 1. Problem

Today the platform effectively has *two* navigation systems that were recently made to
look alike, but still follow different logic:

- The **Comms workspace menu**: a hand-curated, sectioned tree
  (Overview / Workspace / Events / Content) pointing into `/app/comms/*`.
- **Per-role menus**: nine separate trees in `NAV_SECTIONS_BY_ROLE`, one per
  `PlatformRole`, each duplicating largely the same items with small label/href
  variations.

This duplicates structure nine times, makes the Comms space a "separate workspace"
rather than a part of the platform, and means adding one menu item requires touching
up to nine definitions. It also under-uses the permission system: the menus are
curated by role instead of *derived* from access.

## 2. Target principle

> There is exactly **one** navigation tree. The Communications structure is the
> blueprint and stays as-is. Roles do not get their own menus — they get a
> **filtered view** of the master tree, driven by the existing permission matrix
> (`ROLE_SPACE_DEFAULTS` + per-user DB overrides = `effectiveSpaces`).

Consequences:

- The Admin role sees the full tree (Board, User Management, …) — i.e. "the Comms
  menu, extended".
- A Patient Advocate sees the same tree with the comms-only items hidden.
- Granting a user access to a space via a DB override automatically reveals the
  corresponding menu items. No menu code changes.

**One refinement (see §4 / §5.3):** the **Comms role is the single exception** to the
pure-permission rule. Because Comms can *access* spaces (Stories, Initiatives, …)
that should not clutter its workspace sidebar, Comms renders an explicit **curated
blueprint** (`COMMS_NAV_SECTIONS`) — exactly today's comms menu — instead of the
permission-filtered tree. Same dark sectioned style; different source list.

## 3. The master tree

One definition, `MASTER_NAV`, in `src/lib/role-access.ts`. Every item carries the
`PlatformSpace` that gates it (and optionally a minimum access level):

| Section | Item | Gating space | Notes |
|---|---|---|---|
| **Overview** | Dashboard | `dashboard` | `/app/dashboard` (non-comms roles); Comms uses its own `/app/comms/dashboard`, see §5.5 |
| **Workspace** | Planner | `comms` | |
| | Campus | `comms` | live badge (intake count) |
| | WhatsApp | `comms` | |
| | CRM | `comms` | |
| | Initiatives | `initiatives` | |
| | Board | `board` | |
| **Events** | Annual Congress | `congress` | `priority` accent (orange) |
| | Podcast | `comms` | |
| | All events | `comms` | |
| **Community** | Network | `network` | |
| | Stories | `stories` | |
| **Content** | Library | `comms` | |
| | Resources | `resources` | |
| **Account** | User Management | `admin` | min level `manage` |

**Deliberately *not* in the sidebar** (per product decision — these remain
reachable, just not as top-level nav items):

- **Profile** — already accessible from the avatar/account menu top-right; a
  duplicate sidebar entry is removed entirely.
- **Tasks** (`/app/tasks`), **Bureau** (`/app/bureau`), **Partners**
  (`/app/partners`) — removed as standalone nav items. The pages and their
  permission spaces still exist; they are surfaced contextually (e.g. tasks
  within an initiative, partners within the relevant workspace) rather than via a
  dedicated sidebar link. The `tasks` / `bureau` / `partners` spaces are no longer
  referenced by `MASTER_NAV`.

Rendering pipeline (identical for sidebar and mobile drawer):

```
MASTER_NAV
  → filter items: canAccess(effectiveSpaces[item.space], item.minLevel ?? 'view')
  → drop empty sections
  → render (dark #202133 sidebar, uppercase section labels, badge/priority styling)
```

`NAV_SECTIONS_BY_ROLE`, `NAV_BY_ROLE`, `getSideNavItems`, and the
`showCommsWorkspace` / `showCommsNav` flags are deleted. The role only matters
indirectly, as input to the permission resolver.

## 4. Resulting views

The **Communications role keeps its exact curated blueprint** (`COMMS_NAV_SECTIONS`)
— it is the canonical comms workspace, not a permission-expanded menu. Every other
role sees a permission-filtered view of the shared `MASTER_NAV`. Both render in the
same dark sectioned style; the only difference is which tree feeds the filter.

- **Comms** — Dashboard (→ `/app/comms/dashboard`, personal/team toggle) · Planner ·
  Campus · WhatsApp · CRM · Annual Congress · Podcast · All events · Library.
  Identical to the pre-existing comms menu. It does **not** list Initiatives /
  Network / Stories / Resources even though Comms can access those spaces — the
  curated list keeps the menu lean (it must not look like the Admin menu).
- **PlatformAdmin** (`manage` everywhere) — the full `MASTER_NAV`: the comms items
  *plus* Initiatives, Board, Network, Stories, Resources, and User Management.
  ("Extended with further menu items.")
- **PatientAdvocate / Clinician / Researcher** — Dashboard (`/app/dashboard`) ·
  Initiatives · Congress · Network · Stories · Resources. Comms items absent because
  the `comms` space is `invisible` for them.
- **Moderator** (`comms: invisible`) — Dashboard · Initiatives · Congress · Network ·
  Stories · Resources. No comms sub-items.

(No role shows a Profile, Tasks, Bureau, or Partners item — those are removed from
the nav entirely per §3.)

Why Comms is special-cased rather than purely permission-driven: the permission
matrix cannot distinguish "Comms can *manage* Stories" from "Stories belongs in the
Comms menu". Comms manages Stories/Initiatives operationally but its sidebar should
stay focused on the comms workspace, so it gets an explicit curated list. Trimming
those via `ROLE_SPACE_DEFAULTS` instead was rejected — it would also revoke real
access (e.g. `stories: manage`).

## 5. Decision points

### 5.1 Labels (recommendation: neutralize)
Current per-role labels ("My Initiatives" vs "All Initiatives", "Board Overview")
only exist because menus were per-role. With one tree we use neutral labels
("Initiatives", "Stories", "Dashboard"). If product wants possessive labels back, a
small optional `labelOverrides[role]` map can be layered on later — but the default
is one label per item.

### 5.2 Hrefs (decided: one canonical href)
Items currently point to different targets per role:

- Dashboard: `/app/dashboard` vs `/app/comms/dashboard` → **resolved in §5.5**
- Congress: `/app/congress/workspace` vs `/app/congress` → **single href
  `/app/congress`**. The `/app/congress` overview page already links into the
  operational workspace (`/app/congress/workspace`, see its in-page nav), so one
  canonical entry point needs no per-role redirect logic — everyone lands on the
  congress overview and enters the workspace from there.

### 5.5 One dashboard *per audience* (decided — corrected)
Each role has a single dashboard reached via its menu's `Dashboard` item, and that
dashboard is its landing page. There are two dashboard surfaces, kept for different
audiences:

- `/app/comms/dashboard` — the **Communications dashboard**, with the personal/team
  **toggle** ("my dashboard" ↔ "team dashboard": events pipeline, weekly agenda,
  team activity). **This is the dashboard for the Comms role** and the comms menu's
  `Dashboard` item points here. *(An earlier revision deleted this and pointed Comms
  at the shared dashboard — that was wrong; the toggle dashboard is what Comms
  needs, so it is kept/restored.)*
- `/app/dashboard` — the shared, role-aware dashboard for **every other role**
  (coordinator / board / advocate variants).

Decisions:

1. **Comms `Dashboard` → `/app/comms/dashboard`** (curated blueprint, §4); all other
   roles' `Dashboard` → `/app/dashboard` (MASTER_NAV).
2. **Comms landing = the comms dashboard.** Login still targets `/app/dashboard`, so
   `/app/dashboard` **redirects the Comms role to `/app/comms/dashboard`** — making
   the toggle dashboard the comms landing while keeping one entry point for everyone
   else.
3. **Keep the whole team-dashboard cluster** (page, `actions.ts`, `team-dashboard`,
   `team-feed`, `comms-dashboard-toggle`, the agenda forms, `comms-dashboard-data`,
   and its test). The personal pieces (`comms-personal-dashboard*`) remain shared.

### 5.3 Comms menu stays lean (decided — corrected)
The Comms role must see **the same menu as before** — its curated blueprint — not a
permission-expanded list. A purely permission-driven menu would add Initiatives,
Network, Stories, Resources (spaces Comms can access), making it look almost
identical to the Admin menu, which is not wanted. **Decision: Comms uses an explicit
curated section list (`COMMS_NAV_SECTIONS`); all other roles use the permission-
driven `MASTER_NAV`.** Trimming via `ROLE_SPACE_DEFAULTS` was rejected because it
would also revoke real access (e.g. `stories: manage`). (Profile is no longer a
sidebar concern — it lives only in the top-right account menu.)

### 5.4 Finer granularity inside a space (future)
All comms sub-items are currently gated by the single `comms` space. If individual
features (e.g. WhatsApp) ever need separate gating, items can carry an optional
`minLevel` (already supported by the model: `view`/`edit`/`manage`) or, later, a
feature-level space. No structural change required.

## 6. Implementation plan (when approved)

1. **`src/lib/role-access.ts`** — define `MASTER_NAV`
   (`{ id, label, href, space, minLevel?, badge?, priority? }`) and the curated
   `COMMS_NAV_SECTIONS`; `getSideNavSections(role, spaces)` picks the comms
   blueprint for the Comms role and the permission-filtered `MASTER_NAV` otherwise.
   Remove `NAV_BY_ROLE` / `NAV_SECTIONS_BY_ROLE` / `getSideNavItems`.
2. **`src/components/layouts/side-nav.tsx`** — render from
   `getSideNavSections(role, effectiveSpaces)`. Visual blueprint (dark, sectioned)
   unchanged.
3. **`src/components/layouts/top-nav.tsx`** — pass `effectiveSpaces` from the
   server layout into `TopNav` so the mobile drawer uses the same filtered tree
   (it previously re-derived from role defaults client-side and missed DB overrides).
4. **`src/app/app/layout.tsx`** — remove `showCommsWorkspace` branching; compute
   the campus badge whenever the user can view `comms`; thread `role` +
   `effectiveSpaces` to both navs.
5. **Dashboards** (per §5.5) — Comms `Dashboard` → `/app/comms/dashboard` (kept,
   personal/team toggle); all other roles → `/app/dashboard`. `/app/dashboard`
   redirects the Comms role to `/app/comms/dashboard` so the toggle dashboard is the
   comms landing. The team-dashboard cluster is retained.
6. **Congress href** (per §5.2) — Congress → `/app/congress` for all roles. No page
   changes (the overview already links into the workspace).
7. **Tests** — Comms shows its exact blueprint (no Initiatives/Network/Stories/
   Resources); Admin = superset incl. User Management; advocate roles = no comms
   items; DB-override case (granting `comms: view` to a non-Comms role reveals the
   comms items); per-audience dashboard hrefs.
8. **Docs** — update `docs/ROLE_PERMISSION_MODEL.md` and `docs/DESIGN_CHANGELOG.md`.

## 7. Out of scope

- Page-content redesign per role (only entry-view routing in §5.2).
- Changes to the permission matrix semantics or DB schema — the concept
  deliberately reuses `effectiveSpaces` as-is.
