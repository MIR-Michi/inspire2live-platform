# Task: Fix Campus counts, share the WhatsApp digest into Campus, and universal resizable columns

> Status: **specification only — do not implement yet.**
>
> **Depends on** the prior WhatsApp work (branches `feat/whatsapp-feed-categorization`
> and `feat/whatsapp-merge-resizable-columns`): the digest tables
> `whatsapp_feed_summaries` / `whatsapp_feed_items`, the unified WhatsApp
> workspace, and the `ResizableSplit` component. This task builds on those and
> assumes they land first (or is done on a branch stacked on them).

Four related deliverables. Parts 1–3 are Campus-specific and share one
architecture; Part 4 is cross-cutting.

---

## Part 1 — Fix the Campus "orange numbers" (wrong & inconsistent)

### The bug

Three different counters claim to show the same thing and disagree (screenshots:
nav "Campus **75**", overview "**75** incoming" / "**3** incoming", month-detail
"Incoming **0**"). They disagree because each is computed differently:

| Counter | Where | Current definition | Problem |
| --- | --- | --- | --- |
| Nav badge `Campus 75` | `side-nav.tsx:172` ← `commsUnreadCount` (`app/layout.tsx:117`) | **Global** comms unread/waiting intake count (all channels, all time) | Not campus-specific at all — it's the whole comms inbox. |
| Overview card `N incoming` | `campus/page.tsx:140` | `intake_items` with `status='unreviewed'` in the session's **calendar month**, from a `.limit(100)` recent-items query, **not** filtered by `channel` | 100-row cap undercounts busy months; counts *all* channels; calendar-month ≠ meeting window. |
| Month-detail `Incoming N` | `campus/[year]/[month]/page.tsx:234` | length of the selected tab (WhatsApp = `intake_items` where `channel='campus'` in the **calendar month**) | Channel-filtered (so 0 when the others are 75); calendar-month window; counts the visible tab only. |

Net: `75` (all comms, all time) vs `75` (all-channel unreviewed in July) vs `0`
(campus-channel WhatsApp in July) — three definitions, three numbers.

### The fix

Define **one** canonical "incoming" metric for a campus meeting and use it
everywhere:

- **Definition (proposed):** count of `intake_items` with `status='unreviewed'`
  and `channel='campus'` whose `captured_at` falls in that meeting's **window**
  (Part 3: previous meeting → this meeting), via an exact `count` query
  (`select('*', { count: 'exact', head: true })`) — **no `.limit(100)` cap**.
- Extract a single helper (e.g. `countCampusIncoming(supabase, { startIso, endIso })`
  in a shared campus module) and call it from all three sites so they can't drift.
- **Nav badge:** decide what `Campus` should show — recommended: incoming for the
  **current/next** meeting window (the actionable number), not the global comms
  unread. If the global number is still wanted elsewhere, keep it for a different
  item, not `Campus`.
- Confirm whether "incoming" should include Field-newsfeed + Briefing or only
  WhatsApp/intake (the month-detail "Incoming" currently reflects the *active
  tab*, which is itself inconsistent). Recommended: the badge = intake incoming;
  per-tab counts stay per-tab but are labelled as such.

**Acceptance:** the nav badge, the overview card badge, and the month-detail
header show the *same* number for the *same* meeting, and it reflects the true
count (no cap), for the meeting window (not the calendar month).

---

## Part 2 — Show the shared WhatsApp digest inside Campus (reuse, don't regenerate)

Today the Campus month-detail "Incoming → WhatsApp" tab shows the **raw**
campus-channel messages (`campus/[year]/[month]/page.tsx:314`). The user wants it
to show the **WhatsApp digest** — the same *generated content* that appears on the
left side of the WhatsApp workspace (summary + categorized items) — **for that
meeting's window**, and **without generating the data twice**.

### Single-source-of-truth architecture

The digest already lives in `whatsapp_feed_summaries` / `whatsapp_feed_items`
(one reviewable run per window), and the WhatsApp workspace already defaults its
window to *previous → current campus meeting*. Make that record the shared
artifact both surfaces read:

1. **Key the digest to the campus meeting.** `whatsapp_feed_summaries` already has
   a nullable `campus_session_id` (migration `00157`). When a digest is run with a
   campus-meeting window, set `campus_session_id` to the **closing** meeting. Then:
   - WhatsApp workspace: generates/edits the digest (unchanged).
   - Campus month-detail: **reads** the digest for its meeting via
     `campus_session_id` (or by matching `window_start`/`window_end`) — it never
     calls the AI.
2. **Extract the digest "generated content" panel** from
   `whatsapp-workspace-shell.tsx` into a reusable, presentational component
   (e.g. `WhatsAppDigestPanel`: summary + monthly rollup + categorized items,
   optionally read-only). The WhatsApp workspace and the Campus WhatsApp tab both
   render it from the same `whatsapp_feed_items` rows. No duplicated markup, no
   second query shape.
3. **Campus is read-mostly.** In Campus, render the digest read-only (or with the
   same confirm/dismiss proposals if desired — decide in Q4). If **no** digest
   exists for the meeting window, show an empty state with a link/button to the
   WhatsApp workspace (optionally a "Generate for this meeting" that calls the
   **existing** `runWhatsAppDigest` action with the campus window — still one
   record, one generator).

### Channel-scope reconciliation (important)

`intake_items.channel` is `'campus'` | `'communications'` (migration `00049`).
The Campus WhatsApp tab filters `channel='campus'`, but the WhatsApp workspace
digest loader (`lib/comms-whatsapp-feed.ts`) currently scopes by
`sender_whatsapp_id IS NOT NULL` — i.e. **all** WhatsApp channels. So today a
workspace digest is *not* campus-only and can't be reused verbatim by Campus.

Resolve one of:
- **(a)** The community WhatsApp feed *is* the campus group → scope the workspace
  digest to `channel='campus'` too, making one campus digest that both surfaces
  share. (Simplest; confirm the feed identity — the screenshots show "I2L World
  Campus" as the group.)
- **(b)** Keep both channels in the workspace but add a **channel** dimension to
  the digest (`whatsapp_feed_summaries.channel`), generate per channel, and have
  Campus read the `campus` one. (More general; more work.)

Recommendation: **(a)** if the campus group is the community feed; otherwise (b).
This choice must be settled before Part 2 is built — it defines what "the digest"
means.

---

## Part 3 — Campus WhatsApp window = previous → current/upcoming meeting

The Campus WhatsApp window must be **automatic** and **date-driven**: for a given
meeting M, the window is `[date(previous meeting), date(M))`. For the
current/upcoming meeting this is "since the last meeting up to the next one" —
exactly what the user described.

- Replace the month-detail's **calendar-month** bounds (`monthBounds`,
  `campus/[year]/[month]/page.tsx:106`) for the WhatsApp/incoming data with the
  **meeting-to-meeting** window derived from ordered `campus_sessions.session_date`
  (the session immediately before M → M). This is the per-meeting analogue of the
  existing `deriveDefaultWindow` helper (`whatsapp-feed-categorization.ts`) — reuse
  or generalize it so the WhatsApp workspace default and the Campus window come
  from the **same** code.
- The digest the workspace generated for that window (Part 2) then lines up with
  the Campus meeting by construction — same window, same `campus_session_id`, same
  record.
- Keep Briefing / Field-newsfeed windows as-is unless we decide they should follow
  the same meeting window (Q3).

---

## Part 4 — Adaptable left/right width on **all** split pages (general feature)

Make the draggable column resizer (`ResizableSplit`, already built) the standard
for **every** primary two-column page, finishing the rollout the prior branch
deferred. Convert the remaining main/side splits, each verified in a live browser
because several rely on internal scroll/height or seamless borders:

| Surface | File | Note |
| --- | --- | --- |
| Campus month | `campus/[year]/[month]/page.tsx:227` | **Seamless bordered** `lg:grid-cols-[7fr_3fr]` with `min-h-[720px]`, `lg:order-last`, internal `overflow-y-auto`. Needs a divider treatment that preserves the shared border + independent scroll. |
| Conferences master-detail | `conferences-shell.tsx:282` | `lg:h-full` scroll panes — verify both panes still scroll. |
| Media library | `media-library-shell.tsx:450` | `xl` flex height. |
| Event operating | `events/[id]/page.tsx:1179` | Large operating view. |

Already converted (reference implementations): WhatsApp workspace, conference
operating shell, admin AI settings.

Requirements are unchanged from the `ResizableSplit` spec: keyboard-accessible
divider, `localStorage`-persisted ratio **per surface** (`storageKey`), responsive
stacking below the surface's breakpoint, `min-w-0`/`min-h-0` panels so scroll
regions keep working. For the **campus bordered** layout specifically, either
(i) adapt `ResizableSplit` to support a "seam" mode (no gap, divider drawn on the
shared border) or (ii) restyle the campus grid to the standard gapped two-column
before wrapping — decide in Q5.

Incidental `md:grid-cols-2` **form/detail** grids remain out of scope.

---

## Open questions to resolve before coding

1. **Canonical "incoming" definition** — channel = `campus` only? include
   newsfeed/briefing, or intake only? Which window feeds the **nav** badge
   (current/next meeting vs global comms)?
2. **Digest channel scope (Part 2 crux)** — is the community WhatsApp feed the
   campus group (option a), or do we need a per-channel digest (option b)?
3. **Other tabs' window** — should Briefing / Field-newsfeed also switch from
   calendar-month to the meeting-to-meeting window, or only WhatsApp?
4. **Campus digest interactivity** — read-only in Campus, or allow the same
   confirm/dismiss proposals there too (writing back to the shared record)?
5. **Campus bordered layout for the resizer** — add a "seam" mode to
   `ResizableSplit`, or restyle the campus grid to the standard gapped split?
6. **Empty state** — when no digest exists for a meeting window, show a link to
   the WhatsApp workspace, or a "Generate for this meeting" button that calls the
   existing `runWhatsAppDigest` with the campus window?

## Out of scope

- Re-running / duplicating AI generation inside Campus (Campus reads the shared
  digest; at most it *triggers* the existing generator for a window).
- Making incidental form/detail grids resizable.
- Any change to categorization logic, proposals, or RLS beyond the optional
  `channel` column in Part 2(b).

## Suggested order

1. **Part 3 window helper** — one shared "meeting window" function (generalize
   `deriveDefaultWindow`); wire the WhatsApp workspace default and Campus to it.
2. **Part 2 channel decision + keying** — settle Q2; set `campus_session_id`
   (and `channel` if 2b) on digest runs; extract `WhatsAppDigestPanel`.
3. **Part 2 Campus read** — Campus WhatsApp tab renders `WhatsAppDigestPanel` for
   its meeting's digest (read-only), with the empty state.
4. **Part 1 counts** — single `countCampusIncoming` helper; repoint nav, overview,
   and month-detail to it; drop the `.limit(100)` cap.
5. **Part 4 resizer rollout** — convert campus month, conferences master-detail,
   media library, event operating, with live scroll/height QA.

## Testing focus

- Unit: the shared meeting-window derivation (previous→current, edges: first
  meeting, single meeting, ties on `session_date`); `countCampusIncoming` window
  math; digest→meeting resolution by `campus_session_id`/window.
- Integration/manual: nav = overview = month-detail for the same meeting; Campus
  WhatsApp tab shows the same digest as the WhatsApp workspace for the matching
  window; no second AI run is triggered by opening Campus; resizer works (incl.
  scroll intact) on every converted surface.
