# Initiatives (`initiatives`)

Initiative workspaces, members and milestones for coordinators and advocates.

- **Surface:** internal
- **DB schema (target):** `initiatives`
- **Owns tables:** `initiatives`, `initiative_members`, `milestones`
- **Depends on:** kernel [identity, rbac, notifications] · components [tasks@^1]
- **Feature flag:** _(always on)_
- **Requirements:** REQ-INIT-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
