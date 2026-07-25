/**
 * kernel/data — Supabase client factories (browser, server, service-role admin).
 * Namespaced because each sub-module exports a `createClient` for its context.
 */
export * as browser from '@/kernel/data/client'
export * as server from '@/kernel/data/server'
export * as admin from '@/kernel/data/admin'

// Typed access to component-owned tables that predate the next type generation
// (ADR-0009 §3) — the sanctioned alternative to `(supabase as any)`.
export { moduleClient } from '@/kernel/data/module-schema'
export type { ModuleDatabase, ModuleTable, ModuleView } from '@/kernel/data/module-schema'
