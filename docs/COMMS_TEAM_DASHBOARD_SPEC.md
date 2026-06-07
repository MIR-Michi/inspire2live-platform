# Communications Team Dashboard — Product & UX Spec (Draft for Review)

**Status:** Draft for review — not yet scheduled into a sprint
**Author:** Communications workspace working notes
**Date:** 2026-06-07
**Owner space:** Communications Workspace (`/app/comms`)
**Related:** ADR 0006 (Communications Workspace), Sprint 08 (workspace restructure), Sprint 09 (Comms CRM foundation)

---

## 1. Summary

Today the Communications Workspace has a **personal dashboard** — the orange
`CommsDashboardPanel` rendered on `/app/dashboard` for comms users. It answers
*"what needs **my** attention?"* (my tasks, my content, incoming messages,
project summaries, recent decisions).

We want to add a **team dashboard** in the same section: a shared "common
ground" view that answers *"what is the **team** doing, and what needs the team's
attention?"*. Users switch between the two with a single, obvious **toggle**.

The team dashboard's job is to make the whole comms operation legible at a
glance — the two WhatsApp channels (Campus + Communications), all events, and a
single activity/update feed filterable by work status — designed to be **lean,
clean, and usable by people of all ages and comfort levels**. UX is to be
designed and validated *before* implementation.

---

## 2. Goals & non-goals

### Goals
- Add a **Personal ⇄ Team** toggle in the comms dashboard, defaulting to the
  view the user used last.
- Give the comms team one shared screen covering: the two WhatsApp channels,
  all events, and a live update feed.
- Make every item filterable by a **single, normalised work status**:
  *Not started · In progress · Skipped · Completed*.
- Make all events from both stakeholder groups (Campus + Communications)
  intuitively reachable from this one screen.
- Optimise for clarity and low cognitive load across age groups (large targets,
  plain language, no jargon, strong defaults).

### Non-goals (this iteration)
- No new outbound messaging, WhatsApp replies, or sync connectors (consistent
  with Sprint 09 guardrails).
- No new permission model — reuse `canAccessCommsWorkspace`.
- No replacement of the existing planner, events, campus, or CRM tools — the
  team dashboard *links into* them, it does not duplicate them.
- No analytics/reporting charts in v1 (kept for a later iteration).

---

## 3. Where it lives & how the toggle works

- **Route:** keep the comms dashboard at its current entry
  (`/app/comms` → currently the personal panel on `/app/dashboard`). Introduce a
  view parameter so both views share one URL, e.g.
  `/app/comms/dashboard?view=personal` and `?view=team`.
  - *Open question:* the current "Overview → Dashboard" nav item points at the
    global `/app/dashboard`. We should decide whether to (a) add a dedicated
    `/app/comms/dashboard` route that hosts both views, or (b) keep both panels
    on `/app/dashboard` behind the toggle. **Recommendation: (a)** a dedicated
    comms route, so the team view is self-contained and the global dashboard
    stays role-generic.
- **Toggle UI:** a two-segment control at the top of the page —
  `[ My dashboard | Team dashboard ]` — large, high-contrast, with clear active
  state. Persist the last choice (per user) so the toggle "remembers" them.
- **Access:** identical to the rest of the workspace — gated by
  `canAccessCommsWorkspace(role, comms_team, user_type)` in the comms layout.

---

## 4. Team dashboard content

The screen is composed of four stacked, equally-weighted blocks. Order reflects
"shared awareness first, then drill-in."

### 4.1 WhatsApp channels (2)
Two side-by-side cards: **Campus** and **Communications**.
- Each card shows: channel name, count of items waiting for review (unreviewed
  intake), the most recent 2–3 incoming signals (sender + one-line summary +
  time), and a "Open channel intake" link.
- Source of truth: `intake_items` already populated by the WhatsApp webhook
  (`/api/comms/whatsapp`). We need a **channel attribute** distinguishing
  *campus* vs *communications* on intake items (see §6 Data).
- Goal: the team instantly sees which channel is "hot" and jumps in.

### 4.2 Events — both groups, intuitively accessible
A compact, scannable list/grid of **all events**, reachable from one place.
- Surfaces upcoming + in-flight events across scopes already modelled in the
  events pipeline (`i2l`, `networking`, plus the Annual Congress and Podcast).
- Each row: event name, date, scope/type badge, current stage, and owner.
- Filter chips: *All · I2L · Networking · Congress · Podcast · Past*.
- Each row links to the existing event detail (`/app/comms/events/[id]`).
- "Both groups" requirement: events associated with Campus stakeholders and with
  the Communications group should both appear here without the user needing to
  know which underlying list they came from — one merged, filterable view.

### 4.3 Update feed (what's been done / in progress / deadlines)
A reverse-chronological **activity + work feed** — the heart of "common ground."
- Each entry: title, what it is (content card / event task / campus action /
  CRM follow-up), who owns it, its **work status**, and its **deadline** (if any,
  with overdue highlighted).
- Aggregates existing work items the team already produces:
  - Content cards (`content_calendar`)
  - Event outputs & tasks (`events`, tasks)
  - Campus actions/decisions (`campus_sessions`)
  - CRM follow-ups (`comms_crm_*`)
- Sort: deadline-aware (overdue → due soon → no date), matching the personal
  panel's existing "Deadlines" logic.

### 4.4 Status filter (single source of truth)
A persistent filter bar applying to the feed (and optionally events):
**Not started · In progress · Skipped · Completed** (plus *All*).
- These are **normalised** statuses — a presentation layer that maps the
  different underlying status vocabularies into one simple set the team shares
  (see §5). Multi-select; default shows everything except *Completed* and
  *Skipped* so the feed leads with live work.

---

## 5. The unified status model

The platform currently uses several status vocabularies:
- Content calendar: `draft → in_review → scheduled → published → archived`
  (`CalendarStatus`).
- Events: `announced → attending → in_progress → post_event → archived`
  (`EventStage`).
- Tasks: `… → done`.

The team dashboard introduces **one shared status taxonomy** for display and
filtering only — it does **not** change the underlying models. Proposed mapping:

| Unified status | Content calendar | Event stage | Task |
|---|---|---|---|
| **Not started** | `draft` | `announced` | open, not begun |
| **In progress** | `in_review`, `scheduled` | `attending`, `in_progress` | open / in progress |
| **Completed** | `published` | `post_event` | `done` |
| **Skipped** | `archived` | `archived` | cancelled/archived |

**Decision (reviewer, 2026-06-07):** Both *Completed* and *Skipped* map to the
underlying `archived` state — there is no new data state to add. The two are
distinguished **visually only**, in the unified status badge:

| Unified status | Marker | Meaning |
|---|---|---|
| **Completed** | ✅ green tick | the work was finished as planned |
| **Skipped** | 🟧 amber dash | the work was deliberately not done / dropped |

This is purely a presentation-layer distinction inside the status normaliser
(see §6) — e.g. a small piece of metadata or naming convention at archive time
tells the normaliser which badge to render. No schema change is required for
v1; if the team later wants to *report* on "skipped vs completed" separately,
that would justify promoting it to a real field.

---

## 6. Data & implementation notes (high level)

- **WhatsApp channel tagging:** add a `channel` discriminator (`campus` |
  `communications`) to `intake_items`, populated from the webhook payload, so
  the two-channel cards are accurate. Until then we can infer from existing
  routing metadata as a fallback.
- **Status normaliser:** a pure helper (e.g. `comms-status.ts`) mapping each
  source type's status → unified status, fully unit-testable, no DB change.
- **Feed assembly:** reuse the existing server-side fetches already proven in
  `CommsDashboardPanel` (content_calendar, tasks, campus_sessions, events) but
  **team-wide** (not filtered to `author_id = user`).
- **Performance:** team-wide queries are broader; cap each source list and
  paginate the feed. Reuse the `Promise.all` batching pattern already in the
  dashboard page.
- **Reuse:** the `StatCard`, status/stage `*_META` colour tokens, and card
  layouts already exist — the team view should reuse them for visual
  consistency, not invent new components.

---

## 7. UX principles (validate before building)

Designed to be usable across age groups and comfort levels:
1. **One decision at a time.** The toggle and the status filter are the only two
   primary controls. Everything else is read-then-click-through.
2. **Plain language.** "Not started / In progress / Completed / Skipped" — no
   internal jargon (`in_review`, `post_event`) shown to users.
3. **Large, legible targets.** Generous tap/click areas, readable type sizes,
   strong colour contrast (WCAG AA), clear active states.
4. **Strong defaults.** Opens on live work (hides completed/skipped); remembers
   the last toggle choice.
5. **Lean over complete.** Each block shows the few most relevant items with a
   "see all" link into the dedicated tool — the dashboard orients, it doesn't
   try to be every tool.
6. **Consistent with the personal view.** Same visual language so switching
   between Personal and Team feels like the same place.

### Recommended pre-build step
Produce a low-fi wireframe / clickable mock of the team view (toggle, two
channel cards, events list, feed + status filter) and review it with 2–3 comms
users of differing ages before any code is written. UX sign-off is a gate on
implementation.

---

## 8. Acceptance criteria (proposed)

- A **Personal ⇄ Team** toggle is present in the comms dashboard, persists the
  last selection, and is keyboard- and screen-reader-accessible.
- The team view shows **both WhatsApp channels** (Campus + Communications) with
  live waiting-for-review counts and recent signals.
- **All events** from both groups are reachable from the team view with
  scope/type filtering and links to event detail.
- A single **update feed** aggregates content, events, campus, and CRM work with
  owner + deadline, overdue clearly flagged.
- The feed is filterable by the unified status set **Not started / In progress /
  Skipped / Completed**, defaulting to live work.
- Access is restricted to comms-workspace users; no new outbound/sync behaviour
  is introduced.
- UX wireframe reviewed and signed off before implementation.

---

## 9. Out of scope / future

- Charts, throughput metrics, and team-performance analytics.
- Two-way WhatsApp interaction or sending from the dashboard.
- Per-user customisable dashboard layouts.
- A distinct underlying "skipped" data state (resolved as visual-only, §5) —
  could be revisited if the team later wants to report on it separately.

---

## 10. Open questions for reviewer

1. Dedicated `/app/comms/dashboard` route vs. both views on `/app/dashboard`?
   (Recommendation: dedicated route.)
2. ~~Is "Skipped" a real new state, or is it equivalent to "Archived"?~~
   **Resolved:** both Skipped and Completed map to `archived`; they are
   distinguished only by badge — ✅ green tick for Completed, 🟧 amber dash for
   Skipped (see §5).
3. Should the **status filter** also apply to the events block, or only the
   update feed?
4. Default feed view — hide Completed *and* Skipped, or only Completed?
5. Should the team feed be visible to **all** comms users equally, or should some
   blocks (e.g. CRM follow-ups) respect existing ownership/visibility rules?
</content>
</invoke>
