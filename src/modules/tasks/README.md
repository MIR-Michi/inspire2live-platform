# Tasks (`tasks`)

Unified task domain (view + adapters over focused stores) — ADR-0008.

- **Surface:** internal
- **DB schema (target):** `tasks`
- **Owns tables:** `tasks`, `task_comments`, `comms_tasks`, `member_onboarding_tasks`, `meeting_followup_tasks`
- **Depends on:** kernel [identity, rbac, notifications]
- **Feature flag:** _(always on)_
- **Requirements:** REQ-TASK-001, REQ-TASK-002

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
