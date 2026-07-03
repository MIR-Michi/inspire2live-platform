/**
 * onboarding — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "onboarding",
  version: '1.0.0',
  title: "Member Onboarding",
  summary: "New-member onboarding checklist and cascade, synced to the contact spine.",
  surface: "internal",
  data: {
    schema: "onboarding",
    tables: ["member_onboarding"],
  },
  provides: {
    api: ["loadOnboarding"],
    ui: ["OnboardingChecklist"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
    components: ["contacts@^1", "tasks@^1"],
  },
  featureFlag: "comms_team",
  personas: ["communications-coordinator"],
  roles: { read: ["comms_team", "admin"], write: ["comms_team", "admin"] },
  requirements: ["REQ-ONBOARD-001"],
  operations: [],
})

export default manifest
