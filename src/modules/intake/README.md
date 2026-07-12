# Channel Intake (`intake`)

Ingests WhatsApp / channel messages and triages signal vs noise, rule- and AI-assisted.

- **Surface:** internal
- **DB schema (target):** `intake`
- **Owns tables:** `intake_items`, `intake_ai_suggestions`, `intake_classification_corrections`, `intake_classifier_rules`, `intake_classifier_training_examples`, `whatsapp_outbound_messages`, `whatsapp_webhook_events`
- **Depends on:** kernel [identity, rbac, notifications, ai-client] · components [contacts@^1]
- **Feature flag:** `comms_team`
- **Requirements:** REQ-COMMS-INTAKE-001, REQ-COMMS-INTAKE-002

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
