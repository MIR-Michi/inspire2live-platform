/**
 * tasks — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * Stage-1 scaffold: the manifest declares what already exists (tables, surface,
 * contract). Behaviour is unchanged; the owning lib/ui/api files move into this
 * module in the per-component tasks (S16-T05+).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: "tasks",
  version: '1.0.0',
  title: "Tasks",
  summary: "Unified task domain (view + adapters over focused stores) — ADR-0008.",
  surface: "internal",
  data: {
    schema: "tasks",
    tables: ["tasks", "task_comments", "comms_tasks", "member_onboarding_tasks", "meeting_followup_tasks"],
    readViews: ["unified_tasks"],
  },
  provides: {
    api: ["loadTasksForUser", "updateTaskStatus", "reassignTask"],
    ui: ["UnifiedTaskList", "UnifiedTaskStatusControl"],
  },
  dependsOn: {
    kernel: ["identity", "rbac", "notifications"],
  },
  featureFlag: null,
  personas: ["initiative-coordinator", "communications-coordinator"],
  roles: { read: ["authenticated"], write: ["authenticated"] },
  requirements: ["REQ-TASK-001", "REQ-TASK-002"],
  operations: [],
})

export default manifest
