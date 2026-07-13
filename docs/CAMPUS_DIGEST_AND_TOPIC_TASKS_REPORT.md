# Implementation Report — Campus digest sharing, topic tasks, consistent counts

> Status: **implemented.** Built from `docs/CAMPUS_DIGEST_AND_COUNTS_TASK.md`
> plus the new "+ Task per topic" requirement. Designed as reusable toolbox
> pieces so the platform can grow without re-solving these problems.

## The modular toolbox added here

| Piece | Home | Reused by |
| --- | --- | --- |
| `deriveMeetingWindow(dates, meeting)` — previous→this meeting window | `ai-features/domain/whatsapp-feed-categorization.ts` | WhatsApp default window, Campus overview, Campus month, nav badge |
| `campus-metrics` — `countCampusIncoming`, `resolveCurrentMeetingDate`, `isWithinWindow`, `campusWindowIso` | `lib/campus-metrics.ts` | nav badge, Campus overview cards, month-detail header |
| `WhatsAppDigestPanel` — presentational digest (summary + topics + proposals + `+ Task`) | `intake/ui/whatsapp-digest-panel.tsx` | WhatsApp workspace, Campus month WhatsApp tab |
| Shared digest shapes + row mappers | `lib/whatsapp-digest-types.ts` | digest reader (ai-features) + panel (intake), across module boundaries |
| `loadCampusDigest(session)` — single-source digest read | `ai-features/domain/whatsapp-feed-store.ts` | Campus month |
| `ResizableSplit` `variant="seam"` | `components/ui/resizable-split.tsx` | Campus month (bordered), future bordered splits |
| `whatsapp_topic` task context | `unified_tasks` view + `tasks` module | any surface that raises a task from a topic |

## 1. Assign a task from a WhatsApp topic

Each categorized topic in `WhatsAppDigestPanel` has a `+ Task` button opening an
inline form: task title (defaults to the topic), owner (any comms-team member),
optional deadline. `createTopicTask` inserts a normal `comms_tasks` row with
`whatsapp_feed_item_id` set and notifies the assignee.

It reaches "My dashboard" through the **existing** unified-task architecture
(ADR-0008) — no parallel task store:

- Migration `00158` adds `comms_tasks.whatsapp_feed_item_id` and rebuilds the
  `unified_tasks` view so such a task reports `context_kind='whatsapp_topic'`,
  `context_id=<topic id>`.
- `TaskContextKind` gains `whatsapp_topic`; the repository resolves the topic's
  title (label) and links to `/app/comms/whatsapp`; the unified task list renders
  a "WhatsApp" context chip.

Because it rides the unified view, the task appears in the owner's dashboard,
counts toward "open tasks", and inherits status handling with zero new plumbing.

## 2. Shared WhatsApp digest inside Campus (no double generation)

`whatsapp_feed_summaries` is the single source of truth. To make one record serve
both surfaces:

- **Auto-linking:** when a digest runs and its window closes on a campus meeting
  date, `runWhatsAppDigest` sets `campus_session_id` to that meeting (explicit
  selection still wins). So the workspace default window (previous→current
  meeting) produces a record Campus can find.
- **One read path:** `loadCampusDigest(session)` returns the latest pending/saved
  digest for the meeting, mapped to the shared panel shape.
- **One component:** the Campus month WhatsApp tab renders `WhatsAppDigestPanel`
  (`editable={false}`) — the same component and data as the workspace left column.
  Campus never calls the AI. If no digest exists yet, Campus shows a link to the
  WhatsApp workspace; the digest appears automatically once generated.

`+ Task` works in Campus too (topic tasks are surface-agnostic).

## 3. Consistent Campus counts

One canonical definition — **unreviewed `campus`-channel intake within the
meeting window** (previous→current meeting), exact count, no cap — now backs all
three counters that previously disagreed:

- **Nav badge** (`app/layout.tsx`): `countCurrentCampusIncoming` (resolves the
  current/next meeting, derives its window, counts).
- **Overview cards** (`campus/page.tsx`): per-meeting window count via
  `deriveMeetingWindow` + `isWithinWindow` over a single, uncapped fetch.
- **Month-detail header** (`campus/[year]/[month]/page.tsx`): `countCampusIncoming`
  for the same window.

Root causes removed: the 100-row cap, the calendar-month vs meeting-window
mismatch, and the missing `channel='campus'` filter on the nav/overview.

## 4. Drag-resizable Campus columns

`ResizableSplit` gained a `seam` variant (thin full-height divider, no gap) so it
fits seamless-bordered containers. The Campus month grid
(`lg:grid-cols-[7fr_3fr]`, `min-h-[720px]`, internal scroll) is now a
`ResizableSplit variant="seam"` — width is drag-adjustable and persisted, columns
stack below `lg`, and the internal scroll regions are preserved
(`min-w-0`/`min-h-0` panels). This joins the WhatsApp workspace, conference
operating shell, and admin AI as resizable surfaces.

## Architecture notes (built to scale)

- **Boundaries respected:** the shared digest shapes live in `@/lib` so the
  `intake` UI and the `ai-features` reader share them without a cross-module deep
  import (governance boundary test passes).
- **Read vs write split:** Campus is a pure reader of the digest and a writer only
  of tasks (through the same action the workspace uses). The AI runs in exactly
  one place.
- **One window helper** underpins the workspace default, the campus counts, and
  the campus digest resolution — they can't drift.

## Testing & verification

- **Unit:** `deriveMeetingWindow` (5 cases) and `campus-metrics`
  (`campusWindowIso`, `isWithinWindow`, `resolveCurrentMeetingDate` — incl. the
  meeting-is-today edge) added. Full suite green (**439 tests**), including the
  module-boundary and dead-code governance checks.
- **Types/lint/build:** `tsc --noEmit`, `eslint`, and `next build` all pass;
  `/app/comms/campus`, `/app/comms/campus/[year]/[month]`, `/app/comms/whatsapp`
  compile.
- **Not exercised against a live DB/browser:** migration `00158`, the digest
  read/link, and the seam-resizer on the bordered campus layout are typed and
  build-clean but were not run live here — smoke-test the digest→campus link, the
  `+ Task` → dashboard flow, and the campus resizer in a running environment.

## Follow-ups

- Convert the remaining bordered/height-scroll splits (conferences master-detail,
  media library, event operating) to `ResizableSplit` with live QA.
- Optional: allow proposal confirm/dismiss from Campus (currently read-only there).
