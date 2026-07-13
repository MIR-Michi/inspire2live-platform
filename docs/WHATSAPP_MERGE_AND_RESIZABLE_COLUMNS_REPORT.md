# Implementation Report — Unified WhatsApp workspace + drag-resizable columns

> Status: **implemented.** Built from
> `docs/WHATSAPP_MERGE_AND_RESIZABLE_COLUMNS_TASK.md`. Two independent parts.

## Part A — Unified WhatsApp workspace

`/app/comms/whatsapp` and `/app/comms/whatsapp/digest` are now **one** page at
`/app/comms/whatsapp`:

- **Left:** the AI digest — run controls (window From/To, campus session, monthly
  toggle), summary, monthly rollup, and categorized items with human-confirmed
  proposals (birthday/event → calendar, new member → onboarding).
- **Right:** the **media-rich raw feed** — images, video, audio, and documents
  render via the shared `MediaAttachment`, not the old text-only list. Reply
  (inbound) and admin delete are preserved.
- **Traceability:** clicking a left item scrolls to + highlights its source
  message(s) on the right. Because inbound feed items are keyed by their
  `intake_items` id (the same ids the digest stores in `source_message_ids`), the
  highlight maps directly onto the media feed.
- The right feed is scoped to the digest window when a digest exists, else the
  recent feed (200) so the page isn't empty.
- `/app/comms/whatsapp/digest` now **redirects** to `/app/comms/whatsapp`; the
  separate "WhatsApp digest" nav entry is removed.

### Resolved spec questions (Part A)

1. **Single page, interactive feed** — one page; the right feed keeps reply +
   admin delete (nothing lost by the merge).
2. **Flat chronological** right column (oldest-first) — one anchor per message,
   simplest for traceability.
3. **Window vs. recent** — window feed when a digest exists, recent otherwise.
4. **Outbound** — shown for context (never cited as a source).
5. **Media** — signed URLs minted server-side (service-role), same missing-column
   degradation (media 00114 / soft-delete 00113) as the old inbox.
6. **Health / delete** — health link is a header action on the feed panel; admin
   delete is a per-message action for PlatformAdmin.

### Part A files

- New: `src/lib/comms-whatsapp-feed.ts` (media-aware, window-capable feed loader),
  `src/modules/intake/ui/whatsapp-media-attachment.tsx` (shared media renderer),
  `src/modules/intake/ui/whatsapp-feed-list.tsx` (flat media feed with anchors,
  highlight, reply, delete), `src/modules/intake/ui/whatsapp-workspace-shell.tsx`
  (merged two-column shell).
- Rewritten: `src/app/app/comms/whatsapp/page.tsx` (unified page),
  `src/app/app/comms/whatsapp/digest/page.tsx` (redirect).
- Removed: `whatsapp-inbox-shell.tsx` (+ its `components/comms` shim) and
  `whatsapp-digest-shell.tsx` (superseded).
- Updated: nav (`role-access.ts` — digest entry removed), `ai-features` manifest
  (`WhatsAppWorkspaceShell`), README, `role-access.test.ts`.

## Part B — Drag-resizable two-column layouts

`ResizableSplit` (`src/components/ui/resizable-split.tsx`) renders two panels with
a draggable divider:

- **Interaction:** pointer drag (with pointer capture + rAF), `cursor: col-resize`,
  double-click to reset.
- **Accessibility:** the divider is a focusable `role="separator"` with
  `aria-orientation="vertical"` and `aria-valuenow/min/max`; Arrow keys nudge,
  Home/End snap to the clamps.
- **Persistence:** the ratio is saved per `storageKey` in `localStorage` and read
  **after mount** (SSR renders the default → no hydration mismatch).
- **Responsive:** below `lg` the columns stack and the divider is hidden — pure
  CSS (`grid-cols-1` + `lg:[grid-template-columns:var(--split-cols)]`), no JS, no
  flash. Panels are `min-w-0 min-h-0` so feeds/tables shrink and scroll inside
  their track.

Pure math/storage helpers live in `resizable-split-utils.ts` (clamp, template,
pointer→ratio, keyboard step, parse/persist) and are unit-tested.

### Applied surfaces

- **WhatsApp workspace** — the merged page's two columns.
- **Conference operating shell** (`conference-operating-shell.tsx`) — main stage +
  sidebar.
- **Admin AI settings** (`admin/ai/page.tsx`) — provider form + profile aside.

### Deliberately deferred (documented follow-up)

These are **seamless-bordered or height-scroll master-detail** layouts where a
naive wrap risks breaking internal scroll/height or the shared-border look, and I
could not visually verify in a live app in this environment:

- Conferences master-detail (`conferences-shell.tsx`, `lg:h-full` scroll panes)
- Campus month (`campus/[year]/[month]/page.tsx`, seamless bordered `min-h-[720px]`)
- Media library (`media-library-shell.tsx`, `xl` flex height)
- Event operating (`events/[id]/page.tsx`)

`ResizableSplit` is already height-friendly (`min-h-0` panels, `self-stretch`
handle); converting these needs a per-surface pass with live QA on the scroll
regions. Incidental `md:grid-cols-2` form/detail grids are intentionally **not**
in scope.

## Testing & verification

- **Unit:** 11 new `resizable-split-utils` tests (clamp, template, pointer→ratio,
  step, parse, key). Full suite green (**424 tests**), including the dead-code and
  nav governance checks (deleted shim leaves no orphan; nav label expectation
  updated).
- **Types/lint/build:** `tsc --noEmit`, `eslint`, and `next build` all pass;
  `/app/comms/whatsapp`, `/app/comms/whatsapp/digest` (redirect), `/app/admin/ai`,
  and the conferences routes compile.
- **Not exercised against a live DB / browser:** the media-signing, drag
  interaction, and highlight/scroll are typed and build-clean but were not run in
  a live browser here — smoke-test the drag + media feed in a running environment.

## Follow-ups

- Convert the deferred master-detail/bordered surfaces to `ResizableSplit` with
  live scroll/height QA.
- Optional: server-persisted (cross-device) column widths; touch-drag polish.
