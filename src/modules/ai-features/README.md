# AI Features (`ai-features`)

AI-enriched capabilities: org news feed, meeting summaries/transcripts, WhatsApp feed categorization, and AI settings/usage.

- **Surface:** internal
- **DB schema (target):** `ai_features`
- **Owns tables:** `ai_settings`, `ai_usage_log`, `org_feed_config`, `news_feed_items`, `meeting_summaries`, `meeting_transcripts`, `whatsapp_feed_summaries`, `whatsapp_feed_items`
- **Depends on:** kernel [identity, rbac, ai-client, notifications] · components [intake@^1, events@^1, contacts@^1]
- **Feature flag:** `ai`
- **Requirements:** REQ-AI-001

## WhatsApp feed categorization

`domain/whatsapp-feed-categorization.ts` is the WhatsApp analogue of the meeting
summary: for a time window it summarizes the community WhatsApp feed and
classifies salient messages into `birthday`, `new_member`, `event`, `question`,
`news`, `i2l_initiative`, `other`. Each item cites the source `intake_items`
message(s) it came from — the domain drops any item it can't ground in a real
message, so the review UI can always highlight the origin (left→right
traceability). `domain/whatsapp-feed-store.ts` loads the feed window and campus
meeting dates; the review surface is the unified WhatsApp workspace at
`/app/comms/whatsapp` (two-column, drag-resizable: generated content left,
media-rich raw feed right). Downstream routing is
reviewable and human-confirmed: birthday/event → `content_calendar`, new member
→ `member_onboarding`. See `docs/WHATSAPP_FEED_AI_CATEGORIZATION_REPORT.md`.

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
