# Sprint 05 — Tasks (Draft)

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| S05-T01 | Add WhatsApp Business API webhook intake entry point | Codex | Completed | Added `/api/comms/whatsapp` with Meta verification support, raw webhook persistence, duplicate protection, and automatic `intake_items` creation. |
| S05-T02 | Implement rule-based classifier for content type, confidence, and founder signals | Codex | Completed | Added `src/lib/comms-classifier.ts` with explainable built-in rules plus promotable sender rules loaded from the database. |
| S05-T03 | Persist classifier reasoning/audit fields for sensitive comms review | Codex | Completed | Added classifier fields on `intake_items`, webhook event audit storage, reusable rules, and training examples in migration `00038`. |
| S05-T04 | Add coordinator review UX for classifier overrides and replay | Codex | Completed | Intake cards now surface automation source, reasoning, correction logging, optional sender-rule promotion, and classifier replay in the existing classification modal. |
| S05-T05 | Add regression and E2E coverage for webhook → queue flow | Codex | Completed | Added unit coverage for classifier/webhook parsing plus Playwright coverage for webhook ingestion, correction, replay, and the existing comms happy path regression. Stable local verification now runs against the local Supabase stack with `PW_USE_PROD_SERVER=true` to avoid dev-server routing churn during auth. |
