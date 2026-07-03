/**
 * contacts — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "contacts",
  version: '1.0.0',
  title: "Contacts (CRM)",
  summary: "Canonical contact identity, CRM directory, pipelines and campus members.",
  surface: "internal",
  data: {
    schema: "contacts",
    tables: ["comms_crm_contacts", "comms_crm_contact_events", "comms_crm_contact_initiatives", "comms_crm_contact_links", "comms_crm_interactions", "comms_crm_pipelines", "comms_crm_pipeline_stages", "comms_crm_pipeline_members", "comms_crm_connector_backlog", "campus_members"],
  },
  provides: {
    api: ["loadCrmDirectory", "resolveContact"],
    ui: ["CrmDirectory"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
  },
  featureFlag: "comms_team",
  personas: ["communications-coordinator"],
  roles: { read: ["comms_team", "admin"], write: ["comms_team", "admin"] },
  requirements: ["REQ-DATA-CONTACT-001", "REQ-DATA-CONTACT-002"],
  operations: [],
})

export default manifest
