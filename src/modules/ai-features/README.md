# AI Features (`ai-features`)

AI-enriched capabilities: org news feed, meeting summaries/transcripts, and AI settings/usage.

- **Surface:** internal
- **DB schema (target):** `ai_features`
- **Owns tables:** `ai_settings`, `ai_usage_log`, `org_feed_config`, `news_feed_items`, `meeting_summaries`, `meeting_transcripts`
- **Depends on:** kernel [identity, rbac, ai-client, notifications] · components [intake@^1, events@^1, contacts@^1]
- **Feature flag:** `ai`
- **Requirements:** REQ-AI-001

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
