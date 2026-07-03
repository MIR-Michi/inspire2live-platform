# Member Onboarding (`onboarding`)

New-member onboarding checklist and cascade, synced to the contact spine.

- **Surface:** internal
- **DB schema (target):** `onboarding`
- **Owns tables:** `member_onboarding`
- **Depends on:** kernel [identity, rbac, notifications] · components [contacts@^1, tasks@^1]
- **Feature flag:** `comms_team`
- **Requirements:** REQ-ONBOARD-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
