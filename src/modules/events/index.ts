/**
 * events — public API (the ONLY import surface for other modules).
 *
 * Stage-1 scaffold: re-exports the manifest today. The component's domain/ui/api
 * exports (its `provides.api` / `provides.ui`) are added here as files move in
 * during S16-T05+. Other modules import `@/modules/events`, never its internals.
 */

export { manifest } from '@/modules/events/manifest'

// The World Campus session as a publishable source (ADR-0014): a curated,
// publication-intended payload shaped by the kernel `SourceProvider` contract.
// Composed with the publishing space in `src/modules/publishing-registry.ts`;
// `events` itself imports nothing from `publishing`.
export { campusSessionSourceProvider } from '@/modules/events/domain/publishing-sources'
