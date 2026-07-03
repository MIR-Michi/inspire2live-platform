# Patient Stories (`stories`)

The public patient-stories site (read-only, SEO-facing) and its moderation trail.

- **Surface:** public
- **DB schema (target):** `stories`
- **Owns tables:** `patient_stories`, `patient_story_events`, `story_status_changes`
- **Depends on:** kernel [identity]
- **Feature flag:** _(always on)_
- **Requirements:** REQ-STORIES-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
