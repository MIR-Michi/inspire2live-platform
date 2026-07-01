# Cleanup Sprint — legacy removal

**Goal:** remove legacy spaces, workflows, demo content, and dead artefacts that
create noise — **without disrupting anything in use.**

**Guardrail:** nothing gets deleted until it is proven unused *or* explicitly
approved for retirement. Every batch ends with `tsc` + lint + unit tests green,
and a manual smoke of the affected areas. Removals land as small, revertible
commits.

---

## Method (the 4 phases you asked for)

1. **Identify** — enumerate every route, space, workflow, seed/demo artefact.
2. **Verify** — for each, check inbound references (nav, links, imports, RPC/DB
   usage). Split into *provably dead* vs *wired-but-suspected-legacy*.
3. **Archive & clean** — delete provably-dead code; for retired-but-wired
   features, first rewire/neutralise the references, then remove.
4. **Test** — typecheck, lint, unit tests, and targeted manual smoke per batch.

---

## Findings

### A. Provably dead — safe to remove (no product decision needed)
- `src/lib/congress-workspace-demo.ts` — imported by **no runtime code**; only a
  guard test references the *name* to prevent re-introduction. Removing the file
  keeps the guard test green.
- _(Phase 1 will extend this list with a systematic unused-file / unused-export
  scan; only items with zero references land here.)_

### B. Misnamed, NOT dead — refactor, don't delete
- `src/lib/demo-data.ts` — despite the name, it exports `STAGE_META`,
  `STAGE_ORDER`, `normalizeStage`, `InitiativeStage`, which are used by the live
  **Initiatives** pages (`initiatives/[id]/layout.tsx`, `.../milestones`).
  Action: rename to `initiative-stages.ts` and drop any truly-unused demo
  exports — **no behaviour change.**

### C. Wired-but-suspected-legacy SPACES — need your product decision
Each of these still has inbound links/references, so removing them changes live
behaviour. They can't be "verified unused" from code alone — you know which are
retired. Candidates (with where they're still referenced):

| Space / route | Still referenced by | Notes |
|---|---|---|
| `/app/comms/events` (+`[id]`) | comms dashboards, library, intake actions | Your example. Likely superseded by Conferences/Podcast/Campus. Needs dashboards rewired first. |
| `/app/congress/*` + `/app/congress/workspace/*` (~14 pages) | notifications redirect, nav test | Large earlier-version subsystem. |
| `/app/comms/calendar` | 12 refs | |
| `/app/comms/media` (+`[id]`) | 7 refs | |
| `/app/comms/meetings` | 7 refs | |
| `/app/comms/transcripts` | 3 refs | |
| `/app/bureau` | 3 refs | Not in nav. |
| `/app/partners` | 1 ref | Not in nav. |
| `/app/admin/org-feed`, `/app/admin/ai` | admin-only | Keep? |

**Kept (in nav / clearly active), for reference:** dashboard, board, initiatives,
network, resources, stories, tasks, notifications, profile, admin
{users,activity,feedback}, comms {campus, campus-log, conferences, crm,
dashboard, library, planner, podcast, whatsapp, intake}.

### D. Database / seed legacy
- Seed migrations already partly cleaned (`00054_remove_demo_users`,
  `00061_remove_demo_crm_contacts`). Remaining seed content
  (`00005_seed_data`, `00006_wp3_initiative_seed`, `00087_seed_conference_baseline`,
  `00102_seed_crm_campus_import`) is **historical** — migrations are immutable
  history and must NOT be edited/deleted. Any live demo *rows* get removed with a
  new forward migration, gated on which spaces are retired.
- `DEMO_EMAILS` (admin users) is a **live utility** to find/remove demo accounts —
  keep.

---

## Execution plan (staged, revertible)

- **Batch 0 (now):** this plan + Category A dead-file removal + Category B rename.
  Zero behaviour change. Full test pass.
- **Batch 1..n (after scope sign-off):** one retired space per batch —
  (a) rewire/neutralise inbound references, (b) delete pages/components/lib,
  (c) forward migration to drop unused tables/rows if any, (d) test + smoke.
- Each batch is its own commit so anything can be reverted independently.

---

## Open decisions (need your answer to proceed past Batch 0)

Which of the **Category C** spaces are actually retired and should be removed?
(events / congress workspace / calendar / media / meetings / transcripts /
bureau / partners / org-feed / ai) — and should any live **demo rows** in the
database be purged as part of this?
