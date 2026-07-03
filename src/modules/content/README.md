# Content & Media (`content`)

Content calendar, media library and outbound publishing/integration intents.

- **Surface:** internal
- **DB schema (target):** `content`
- **Owns tables:** `content_calendar`, `media_assets`, `media_recovery_offers`, `media_recovery_requests`, `comms_integration_intents`, `comms_digest_runs`
- **Depends on:** kernel [identity, rbac, notifications] · components [intake@^1, events@^1]
- **Feature flag:** `comms_team`
- **Requirements:** REQ-COMMS-CONTENT-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
