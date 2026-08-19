# docs: Publishing space — concept, ADR-0014 and the Sprint 21 plan

- **Date:** 2026-08-19
- **Author:** Cursor cloud agent (for Michael Wittinger)
- **Type:** docs
- **Scope:** architecture / comms · publishing · campus · content
- **Links:** `docs/PUBLISHING_SPACE_CONCEPT.md` · `docs/ADR/0014-publishing-space.md` · `sprints/sprint-21-publishing-space/` · REQ-PUB-001…005 (`planned`)

## Context

The request, in two steps. First: a button that creates a LinkedIn post from the content of a specific
page (for example a World Campus event), designed to fit the modular kernel + component architecture
and the future component library. Then, after reviewing that concept: make it a **Publishing space**
that will later cover LinkedIn posts, newsletters and website articles — starting with the LinkedIn
post — where the source can be a platform page *or* a screenshot plus a description, generated through
the platform's own AI, with a UX that is intuitive, low on text, and guided by design. And set up a
sprint for it.

The second step changes the shape materially. A space serves both situations that end in "someone
should post about this": the one where the platform already holds the material (a campus meeting with a
summary, publication decisions and a named presenter — retyped into LinkedIn today) and the one where
it holds nothing (a conference photo, a screenshot of an abstract — which today becomes nothing at all).
It also forces the architecture: a screenshot has no owning record, so the pipeline cannot assume its
input is a database row.

## Change

Planning documentation only. No code, no migration, no schema change, no runtime behaviour.

- **`docs/PUBLISHING_SPACE_CONCEPT.md`** (renamed from `CHANNEL_SYNDICATION_CONCEPT.md` and
  substantially rewritten) — the concept. Read §3 (the seam), §5 (the source contract), §9 (the UX) and
  §8 (privacy and rights) first; those carry the decisions.
- **`docs/ADR/0014-publishing-space.md`** — new, accepted. Nine decisions: one generic `publishing`
  component; a source is a declared, curated payload rather than a page read; an uploaded screenshot is
  a source and not a second code path; composition in a top-level registry file so the drafter depends
  on no source owner; a channel is data plus an optional connector, never a module; approved copy hands
  over to `content`'s own calendar action with provenance written back by the provider; `source_id`
  carries no FK; human approval is unconditional and not configurable; and the kernel AI client is
  widened additively for image input.
- **`sprints/sprint-21-publishing-space/`** — new sprint: `description.md` (goal, rationale, 17
  acceptance criteria, explicit out-of-scope) and `tasks.md` (22 tasks, S21-T01 … S21-T22, T01 already
  `Completed` since it is this documentation).
- **`docs/README.md`** — concept row updated for the rename and new scope; ADR index row for 0014;
  freshness date bumped.
- **`docs/TRACEABILITY.md`** — the four proposal-stage `REQ-SYN-*` rows are replaced by five
  `REQ-PUB-001…005` rows scoped to Sprint 21, at status `planned`.
- **`sprints/README.md`** — Sprint 21 entry.
- **`CHANGELOG.md`** — `[Unreleased] → Documentation` entry replacing the earlier concept-only entry.

Notable decisions relative to the first draft: the component is named **`publishing`** (the user's
vocabulary, settling the open naming question against `syndication`); the capability is a **space** with
its own route and nav entry rather than a button, with the campus-page button reduced to a deep link
that skips step one; and screenshot support requires a small **kernel AI client change** —
`AiMessage.content` is `string` today, so it cannot carry an image.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test && pnpm governance && pnpm build` — green: typecheck clean,
  lint 0 errors (1 pre-existing warning, `notifyConferenceContact` unused in
  `src/app/app/comms/conferences/actions.ts`, untouched here), 624 unit tests in 71 files passing, all 6
  governance gates passing, production build succeeded. Run as the standing gate, not because Markdown
  can break it. `pnpm test:e2e` skipped — no runtime surface changed.
- No behavioral evidence to drive: nothing was implemented. The claims the documents make about the
  current codebase were checked against the code rather than assumed. The load-bearing ones:
  - `AiMessage.content` is `string` (`src/kernel/ai-client/client.ts`) and `buildMessageRequest`
    forwards `messages` verbatim — which is what makes the image change additive.
  - There is **no** comms upload path into Supabase storage today: the media library writes
    `media_assets` rows with SharePoint URLs and never sets `storage_path`. The closest patterns are
    `uploadTranscript` + the `meeting-transcripts` bucket (`00078`) and `signInboundMediaUrl`.
  - `CalendarChannel` already contains `linkedin`, `newsletter` and `wordpress` — "website article" is
    the existing `wordpress` channel, so no second channel vocabulary is needed.
  - Nav is `src/kernel/rbac/role-access.ts`; a new entry needs a `NavItem` in **both**
    `COMMS_NAV_SECTIONS` and `MASTER_NAV` plus a new `NavIcon` key and its SVG in `side-nav.tsx`.
  - The design system has `ActionModal`, `CollapsibleCard`, `StatusBadge` and the skeletons, but **no**
    drawer, file-drop or toast primitive — hence the two new kernel UI primitives in S21-T13.
  - `pnpm governance` runs six test files (not three, as AGENTS.md §6 phrases it); the new
    source-reconciliation gate would be a seventh.
  - Highest migration on `main` is `00172`, so the sprint's migration is `≥ 00173`.

## Risk & rollback

Low — documentation only. Rollback is deleting the ADR and the sprint folder and reverting the doc
edits. The renames are `git mv`, so history is preserved.

The real risks belong to the work itself and are recorded in concept §13 and ADR-0014's consequences:
an additive but shared kernel type change, a FK-free `source_id`, two new UI primitives to build, and
the possibility that a "generic" design is still campus-shaped — for which Stage 2 (a second source and
the newsletter channel, needing no `publishing` code change) is the scheduled acid test.

## Follow-ups

- Sprint 21 execution — `sprints/sprint-21-publishing-space/tasks.md`, S21-T02 onward.
- Two decisions worth settling while building: who is the publisher of record when an approved draft
  turns out to be wrong, and which linked source comes second (it decides how quickly Stage 2 proves the
  seam).
- Deferred by design (concept §13): media on the post for linked sources, three variants or one,
  multi-language, whether ad-hoc uploads should also land in the media library, and whether `intake`
  becomes a source.
- AGENTS.md §6 describes "three" governance gates while `pnpm governance` runs six test files. Not
  touched here to keep this change documentation-scoped for one feature; worth a one-line fix in a
  future PR.
