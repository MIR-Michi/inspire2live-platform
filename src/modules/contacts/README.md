# Contacts (CRM) (`contacts`)

Canonical contact identity, CRM directory, pipelines and campus members.

- **Surface:** internal
- **DB schema (target):** `contacts`
- **Owns tables:** `comms_crm_contacts`, `comms_crm_contact_events`, `comms_crm_contact_initiatives`, `comms_crm_contact_links`, `comms_crm_interactions`, `comms_crm_pipelines`, `comms_crm_pipeline_stages`, `comms_crm_pipeline_members`, `comms_crm_connector_backlog`, `campus_members`
- **Depends on:** kernel [identity, rbac, notifications]
- **Feature flag:** `comms_team`
- **Requirements:** REQ-DATA-CONTACT-001, REQ-DATA-CONTACT-002

The declarative contract lives in [`manifest.ts`](./manifest.ts); the public API is
[`index.ts`](./index.ts). This is a Stage-1 scaffold (see
`sprints/sprint-16-modular-component-foundation/`): the manifest declares what already
exists; the owning `lib`/`components`/route files move into `domain/`, `ui/` and
`api/` here during the per-component tasks (S16-T05+), with no behaviour change.
