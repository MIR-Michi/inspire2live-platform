/**
 * content — public API (the ONLY import surface for other modules).
 *
 * Stage-1 scaffold: re-exports the manifest today. The component's domain/ui/api
 * exports (its `provides.api` / `provides.ui`) are added here as files move in
 * during S16-T05+. Other modules import `@/modules/content`, never its internals.
 */

export { manifest } from '@/modules/content/manifest'

// The calendar owner's own create action (ADR-0009 §9 rule 3) — how other
// components (podcast handover, publishing handover) land entries in the
// calendar without a cross-module insert.
export { createCalendarEntry } from '@/modules/content/domain/calendar-entries'
export type {
  CreateCalendarEntryInput,
  CreateCalendarEntryResult,
} from '@/modules/content/domain/calendar-entries'

// The outbound integration-intent log (Phase 1 delivery audit trail).
export { logIntegrationIntent } from '@/modules/content/domain/comms-integration-intents'
