# Task: Unify WhatsApp + WhatsApp digest, and make two-column layouts drag-resizable

> Status: **specification only — do not implement yet.** Two **independent**
> deliverables in one brief. Part A is scoped to the WhatsApp surface; Part B is
> a cross-cutting UI capability. They can ship separately and in either order.

---

# Part A — Merge "WhatsApp" and "WhatsApp digest" into one page

## A1. Goal

Today there are two separate nav entries and pages:

- **WhatsApp** (`/app/comms/whatsapp`) — the inbox: inbound + outbound threads
  with full media rendering (images, videos, audio, documents), reply, health
  link, soft-delete. Shell: `src/modules/intake/ui/whatsapp-inbox-shell.tsx`;
  page: `src/app/app/comms/whatsapp/page.tsx`.
- **WhatsApp digest** (`/app/comms/whatsapp/digest`) — the AI summary +
  categorization, two-column, with a **text-only** raw feed on the right. Shell:
  `src/modules/intake/ui/whatsapp-digest-shell.tsx`; page:
  `src/app/app/comms/whatsapp/digest/page.tsx`.

Collapse these into **one** WhatsApp page. The **left** column is the generated
content (run controls, summary, monthly rollup, categorized items + proposals);
the **right** column is the **raw WhatsApp feed including pictures and videos** —
i.e. the media-rich rendering that the inbox already has, not the digest's
text-only list.

## A2. Current state (what to reconcile)

- The digest right column is built from a **text-only** projection of
  `intake_items` (`loadWhatsAppFeedWindow` → `{ id, senderName, text, timestamp }`).
  It has **no media**.
- The inbox already renders media: `MediaAttachment` in the inbox shell handles
  `image` / `video` / `audio` / `document`, and the inbox page
  (`whatsapp/page.tsx`) mints short-lived **signed URLs** for stored media with a
  service-role client (`signInboundMediaUrl`), degrading gracefully when the
  media / soft-delete columns aren't present. Feed items are
  `WhatsAppThreadMessage` (`src/lib/comms-whatsapp-thread.ts`), and for **inbound**
  messages `WhatsAppThreadMessage.id === intake_items.id`.
- Crucially, the digest's traceability refs are `intake_items` ids
  (`whatsapp_feed_items.source_message_ids`). Because inbound feed-item ids are
  the same `intake_items` ids, the existing left→right highlight **will map onto
  the media-rich feed items unchanged** — as long as the right column is keyed by
  those ids.

## A3. Target design

One page at `/app/comms/whatsapp` (drop the separate `/digest` route and its nav
entry). Two columns:

- **Left — generated content:** the digest run controls (window From/To, campus
  session, monthly toggle, "Categorize feed"), the summary / monthly rollup, and
  the categorized items with confirm/dismiss proposals — the current
  `whatsapp-digest-shell.tsx` left column, unchanged in behaviour.
- **Right — the raw feed with media:** reuse the inbox's media rendering
  (`MediaAttachment` and the feed-item layout) so images/videos/audio/documents
  display. Each feed item keeps a stable DOM anchor by `intake_items` id so
  clicking a left item scrolls to + highlights its source(s), exactly as now.

The right column must therefore load the **media-enriched** feed for the window:
inbound `intake_items` **with** their media columns + signed URLs (mirroring
`whatsapp/page.tsx`), not the text-only `loadWhatsAppFeedWindow`. Extend the feed
loader (or add a media-aware variant) that:
- filters to the digest window `[startIso, endIso)`,
- selects the media columns (`media_type, media_mime_type, media_storage_path,
  media_filename, media_status`) with the same missing-column degradation,
- signs stored media via a service-role client, and
- returns `WhatsAppThreadMessage`-shaped items so the inbox renderer can be reused.

## A4. Decisions to confirm before coding

1. **Single page vs. tabs.** Preferred: **one** two-column page (generated left,
   feed right). Confirm we are *not* keeping a separate inbox tab. If the inbox's
   **reply / thread** interactions must stay, decide whether the right column is
   (a) read-only feed in the digest context, or (b) the full interactive inbox
   feed (reply forms, status badges) reused verbatim. Recommendation: **(b)** —
   reuse the interactive feed so nothing is lost by the merge.
2. **Threading vs. flat.** The inbox groups into per-contact threads
   (`groupIntoThreads`); the digest feed is flat-chronological. For traceability
   highlight, a **flat chronological** right column is simpler (one anchor per
   message). Confirm flat-chronological for the merged view, or keep threads with
   per-message anchors.
3. **Window vs. recent.** The right feed should reflect the **digest window** when
   a digest exists. Before any run (no digest yet), show the **recent** feed
   (e.g. last N) so the page isn't empty. Confirm the empty-state window.
4. **Outbound.** Categorization stays inbound-only. Confirm whether the right
   column still shows outbound replies for context (it does today in the inbox).
   Recommendation: show outbound for context; it's simply never cited as a source.
5. **Media performance.** Signed URLs are short-lived and require a service-role
   client. Confirm signing the full window is acceptable, or cap/paginate media
   signing for large windows.
6. **Health / soft-delete affordances.** Where do the inbox's "health" link and
   admin soft-delete go on the merged page? (e.g. a header action.)

## A5. Files likely touched

- **Remove/redirect:** `src/app/app/comms/whatsapp/digest/page.tsx` (fold into
  `whatsapp/page.tsx`, or keep a redirect for a release); drop the
  `comms-whatsapp-digest` nav entries in `src/kernel/rbac/role-access.ts` (both
  role blocks) and update `src/test/unit/role-access.test.ts`.
- **Page:** `src/app/app/comms/whatsapp/page.tsx` becomes the unified two-column
  page (loads digest state + media-enriched window feed + campus options).
- **Feed loader:** extend `src/modules/ai-features/domain/whatsapp-feed-store.ts`
  (or a new `loadWhatsAppFeedWindowWithMedia`) to return media + signed URLs.
- **Shell:** merge `whatsapp-digest-shell.tsx` (left) with the media rendering
  from `whatsapp-inbox-shell.tsx` (right). Prefer factoring the inbox's
  `MediaAttachment` + feed-item into a shared component both shells import, to
  avoid divergence.
- **Manifest / README / CHANGELOG:** update surface names.

## A6. Guardrails

- Preserve the existing missing-column degradation (media 00114, soft-delete
  00113) so the page still renders on DBs without those columns.
- Keep signed-media handling server-side (service-role client), never in the
  client bundle.
- Traceability must survive the merge: right-column items keyed by `intake_items`
  id; the left→right highlight/scroll behaviour is unchanged.
- No behaviour change to categorization, proposals, or RLS.

---

# Part B — Drag-resizable two-column layouts (cross-cutting)

## B1. Goal

On every **primary two-column workspace** layout (the merged WhatsApp page, plus
Conferences, Campus, and others), let the user **drag a divider** between the two
columns to adjust their relative width, with the choice remembered.

## B2. In-scope surfaces (primary main+side splits)

These use a deliberate main/side split and are the targets — grep confirmed:

| Surface | File | Current split |
| --- | --- | --- |
| WhatsApp (merged, Part A) | `whatsapp` page/shell | left/right |
| Conference operating | `src/modules/events/ui/conferences/conference-operating-shell.tsx:185` | `lg:grid-cols-[1fr_300px]` |
| Event operating | `src/app/app/comms/events/[id]/page.tsx:1179` | `lg:grid-cols-[1fr_300px]` |
| Campus month | `src/app/app/comms/campus/[year]/[month]/page.tsx:227` | `lg:grid-cols-[7fr_3fr]` |
| Conferences shell | `src/modules/events/ui/conferences/conferences-shell.tsx:282` | `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]` |
| Media library | `src/modules/content/ui/media-library-shell.tsx:450` | `xl:grid-cols-[1.25fr_0.95fr]` |
| Admin AI settings | `src/app/app/admin/ai/page.tsx:101` | `lg:grid-cols-[1.2fr_0.8fr]` |

**Out of scope:** incidental `md:grid-cols-2` / `sm:grid-cols-2` **form and
detail grids** (CRM, library cards, campus-log forms, event-create, etc.). Those
are content grids, not resizable panels. Only the main/side workspace splits get
a divider.

## B3. Proposed component

A reusable client component, e.g. `ResizableSplit` (suggested home:
`src/components/ui/resizable-split.tsx` — confirm the repo's shared-UI location):

- Renders `left`, a **draggable divider**, and `right` using a CSS-grid template
  whose middle track is the handle and whose side tracks are driven by a
  JS-updated ratio (e.g. `gridTemplateColumns: '${leftFr}fr 10px ${rightFr}fr'`).
- **Props:** `storageKey` (persistence id), `defaultRatio` (e.g. `0.66`),
  `min`/`max` ratio or px clamps, `disabledBelow` breakpoint (stack + hide
  divider on small screens), and the two panel children.
- **Interaction:** pointer events with pointer capture (`onPointerDown/Move/Up`),
  `requestAnimationFrame`-batched updates, `cursor: col-resize`, and a visible
  hover/active handle.

## B4. Requirements

1. **Accessibility.** Divider is focusable with `role="separator"`,
   `aria-orientation="vertical"`, `aria-valuenow/min/max`; Arrow keys nudge width,
   Home/End snap to min/max, and there's a double-click-to-reset. Respect
   `prefers-reduced-motion`.
2. **Persistence.** Remember the ratio per layout in `localStorage` under
   `storageKey`. Read after mount only (SSR-safe — no hydration mismatch; server
   renders `defaultRatio`).
3. **Responsive.** Below the layout's breakpoint the columns **stack** and the
   divider is hidden/disabled (match each surface's existing `lg`/`xl` breakpoint).
4. **Clamps.** Enforce sensible min widths so neither panel collapses to unusable;
   panels must keep `min-width: 0` so content (tables, feeds) can shrink/scroll.
5. **No layout regressions.** Sticky side panels, internal scroll regions
   (e.g. the WhatsApp feed's `overflow-y-auto`, campus calendar min-heights) must
   keep working inside the resized tracks.
6. **Touch.** Pointer events cover touch; verify the handle has an adequate hit
   area on touch devices (or disable drag on coarse pointers if simpler for v1).

## B5. Decisions to confirm

1. **In-house vs. dependency.** Default: a small in-house component (~100–150
   lines), consistent with the repo's low-dependency style. Confirm no preference
   for a library (e.g. `react-resizable-panels`); if a lib is acceptable, it
   handles a11y/persistence/touch for us — weigh bundle cost vs. build time.
2. **Persistence scope.** Per-browser `localStorage` (proposed) vs. per-user
   server preference. Recommendation: `localStorage` for v1.
3. **Rollout.** Convert all in-scope surfaces at once, or land the component +
   WhatsApp first and migrate the others incrementally? Recommendation:
   component + WhatsApp first, then a mechanical migration PR for the rest.
4. **Shared-UI location & naming** for the component.

## B6. Testing

- **Unit** (pure logic extracted from the component): ratio clamping,
  px↔ratio conversion, `localStorage` load/save, keyboard-step math.
- **Component/interaction** (if the repo has a DOM test setup): pointer-drag
  updates the template, Arrow-key nudge, reset, and stacked/disabled state below
  the breakpoint.
- **Regression:** each migrated surface still renders and its internal scroll /
  sticky regions behave.

---

## Out of scope (both parts)

- Any change to categorization, proposals, RLS, or the AI workloads.
- Making incidental form/detail grids resizable.
- Horizontal (row) splitters or nested/multi-pane splits — vertical two-column
  only for v1.
- Server-persisted, cross-device column widths (v1 is per-browser).

## Suggested order

1. **Part B component first** (`ResizableSplit` + unit tests), because Part A's
   merged page can adopt it immediately.
2. **Part A merge** (unified WhatsApp page with media-rich right column), using
   the new splitter for its two columns.
3. **Mechanical migration** of the remaining in-scope surfaces to `ResizableSplit`.
