/**
 * initiatives — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "initiatives",
  version: '1.0.0',
  title: "Initiatives",
  summary: "Initiative workspaces, members and milestones for coordinators and advocates.",
  surface: "internal",
  data: {
    schema: "initiatives",
    tables: ["initiatives", "initiative_members", "milestones", "resources"],
  },
  provides: {
    api: ["loadInitiative", "loadInitiativeMembers"],
    ui: ["InitiativeWorkspace"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
    components: ["tasks@^1"],
  },
  featureFlag: null,
  personas: ["initiative-coordinator"],
  roles: { read: ["authenticated"], write: ["coordinator", "admin"] },
  requirements: ["REQ-INIT-001"],
  operations: [],
})

export default manifest
