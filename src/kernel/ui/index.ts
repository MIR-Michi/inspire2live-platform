/**
 * kernel/ui — shared design-system primitives (the kernel UI surface).
 *
 * Stage 1 keeps several implementations in `src/components/ui`; this barrel is
 * the stable component-library contract. New cross-cutting surfaces import from
 * here while physical moves happen incrementally under ADR-0009.
 */
export * from '@/components/ui/action-modal'
export * from '@/components/ui/client-buttons'
export * from '@/components/ui/collapsible-card'
export * from '@/components/ui/confetti-burst'
export * from '@/components/ui/invite-combobox'
export * from '@/components/ui/page-skeleton'
export * from '@/components/ui/query-diagnostics'
export * from '@/components/ui/resizable-split'
export * from '@/components/ui/skeleton'
export * from '@/components/ui/status-badge'
export * from '@/components/ui/tile-group'

export * from '@/kernel/ui/dashboard/adaptive-dashboard'
export * from '@/kernel/ui/design-system-context'
export * from '@/kernel/ui/task-celebration-host'
export * from '@/kernel/ui/task-completion-celebration'
