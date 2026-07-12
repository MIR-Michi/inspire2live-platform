/**
 * kernel/ui — shared design-system primitives (the kernel UI surface).
 *
 * Stage-1: the components still live in src/components/ui; this barrel
 * establishes the @/kernel/ui import surface. The files move under kernel in a
 * later pass. Re-exported with 'export *' (named exports).
 */
export * from '@/components/ui/action-modal'
export * from '@/components/ui/client-buttons'
export * from '@/components/ui/collapsible-card'
export * from '@/components/ui/confetti-burst'
export * from '@/components/ui/invite-combobox'
export * from '@/components/ui/page-skeleton'
export * from '@/components/ui/query-diagnostics'
export * from '@/components/ui/skeleton'
export * from '@/components/ui/status-badge'
export * from '@/components/ui/tile-group'
