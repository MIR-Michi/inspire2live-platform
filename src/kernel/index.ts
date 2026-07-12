/**
 * The platform kernel — cross-cutting concerns every component may depend on and
 * no component owns (ADR-0009 §7). Prefer importing the specific sub-area
 * (`@/kernel/rbac`, `@/kernel/data`, …) over this root barrel.
 */
export * as manifest from '@/kernel/manifest'
export * as identity from '@/kernel/identity'
export * as rbac from '@/kernel/rbac'
export * as notifications from '@/kernel/notifications'
export * as aiClient from '@/kernel/ai-client'
export * as data from '@/kernel/data'
export * as shell from '@/kernel/shell'
export * as ui from '@/kernel/ui'
