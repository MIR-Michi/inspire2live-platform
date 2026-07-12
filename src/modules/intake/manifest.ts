/**
 * intake — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "intake",
  version: '1.0.0',
  title: "Channel Intake",
  summary: "Ingests WhatsApp / channel messages and triages signal vs noise, rule- and AI-assisted.",
  surface: "internal",
  data: {
    schema: "intake",
    tables: ["intake_items", "intake_ai_suggestions", "intake_classification_corrections", "intake_classifier_rules", "intake_classifier_training_examples", "whatsapp_outbound_messages", "whatsapp_webhook_events"],
  },
  provides: {
    api: ["loadIntakeQueue", "promoteIntakeItem"],
    events: ["intake.item.promoted"],
    ui: ["IntakeQueue"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications", "ai-client"],
    components: ["contacts@^1"],
  },
  featureFlag: "comms_team",
  personas: ["communications-coordinator"],
  roles: { read: ["comms_team", "admin"], write: ["comms_team", "admin"] },
  requirements: ["REQ-COMMS-INTAKE-001", "REQ-COMMS-INTAKE-002"],
  operations: ["classify-inbound", "suggest-structure"],
})

export default manifest
