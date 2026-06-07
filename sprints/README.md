# Sprints — Inspire2Live Platform

Active delivery is organised into **two-week sprints**. Each sprint folder is the canonical source of truth for what is being built, why, and where each task stands.

## Conventions

- **One folder per sprint:** `sprint-NN-short-name/`.
- **`description.md`** in each sprint folder contains:
  - **Goal** — what shipping this sprint produces.
  - **Rationale** — why this sprint is sequenced where it is, referencing the Concept Update or Design Document.
  - **Acceptance criteria** — checklist that must be true for the sprint to be considered complete.
- **`tasks.md`** in each sprint folder is a table of tasks with these columns:
  - `ID` — `S{NN}-T{NN}` task identifier.
  - `Task` — what is being built.
  - `Owner` — who is accountable (default: TBD until sprint start).
  - `Status` — one of: `Not Started` · `In Progress` · `Completed` · `Blocked`.
  - `Notes` — links to PRs, ADRs, blockers.

## Task status workflow

```
Not Started ──▶ In Progress ──▶ Completed
                     │
                     ├─▶ Blocked
                     │
                     └─▶ (move to next sprint if descoped, with note)
```

Update task status inline in the sprint's `tasks.md` as work progresses. Do not move completed tasks out of the sprint — they remain part of the sprint record.

## Current MVP plan

The MVP is the **Communications Workspace pilot** per `docs/PLATFORM_CONCEPT_UPDATE_v1.md`. Four sprints take it from foundation to a live pilot with the comms team.

| Sprint | Folder | Theme | Weeks | Exit milestone |
|---|---|---|---|---|
| 01 | [`sprint-01-foundation-and-comms-shell/`](sprint-01-foundation-and-comms-shell/description.md) | DB foundation + comms shell + `comms_team` flag | 1–2 | M2 — Comms shell live |
| 02 | [`sprint-02-intake-and-calendar/`](sprint-02-intake-and-calendar/description.md) | Manual intake form + queue + content calendar | 3–4 | M3 — Intake usable |
| 03 | [`sprint-03-events-and-campus-log/`](sprint-03-events-and-campus-log/description.md) | Event pipeline + World Campus Log + Peter signal layer | 5–6 | M4 — Full routing |
| 04 | [`sprint-04-media-and-pilot-launch/`](sprint-04-media-and-pilot-launch/description.md) | Media library + integration stubs + comms team pilot | 7–8 | M5 — Pilot live |

After Sprint 04 ships the MVP, Phase 2 begins: WhatsApp Business API webhook, rule-based classifier, WordPress/LinkedIn/Mailchimp publish APIs, SharePoint Graph API, re-promotion of the initiative workspace. Draft placeholder backlogs now exist for:

- [`sprint-05-intake-automation-and-classification/`](sprint-05-intake-automation-and-classification/description.md)
- [`sprint-06-publishing-connectors-and-distribution/`](sprint-06-publishing-connectors-and-distribution/description.md)
- [`sprint-07-media-graph-and-pilot-hardening/`](sprint-07-media-graph-and-pilot-hardening/description.md)
- [`sprint-08-comms-user-type-and-workspace-restructure/`](sprint-08-comms-user-type-and-workspace-restructure/description.md)

These remain planning placeholders until the Sprint 04 pilot review is complete.

- [`sprint-09-comms-crm-foundation/`](sprint-09-comms-crm-foundation/description.md)
- [`sprint-10-brand-identity-alignment/`](sprint-10-brand-identity-alignment/description.md)

## How to read a sprint

1. Open the sprint's `description.md` — understand goal, rationale, acceptance criteria.
2. Open `tasks.md` — find tasks in `Not Started` or `In Progress`.
3. Pick a task, change its status to `In Progress`, do the work.
4. On completion: update the row to `Completed`, link the PR or commit in Notes.
5. When all acceptance criteria are checked off, mark the sprint complete in `description.md` and start the next one.

## References

- Strategic scope: `docs/MVP_SCOPE_AND_ROADMAP.md`
- Concept update (Phase 1 source): `docs/PLATFORM_CONCEPT_UPDATE_v1.md`
- Original spec (Phase 2+ source): `Inspire2Live_PLATFORM_DESIGN_DOCUMENT.md`
- Engineering conventions: `docs/IMPLEMENTATION_GUIDE.md`
- Requirements traceability: `docs/TRACEABILITY.md`
