/**
 * initiatives — public API (the ONLY import surface for other modules).
 *
 * Stage-1 scaffold: re-exports the manifest today. The component's domain/ui/api
 * exports (its `provides.api` / `provides.ui`) are added here as files move in
 * during S16-T05+. Other modules import `@/modules/initiatives`, never its internals.
 */

export { manifest } from '@/modules/initiatives/manifest'
