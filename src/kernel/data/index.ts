/**
 * kernel/data — Supabase client factories (browser, server, service-role admin).
 * Namespaced because each sub-module exports a `createClient` for its context.
 */
export * as browser from '@/kernel/data/client'
export * as server from '@/kernel/data/server'
export * as admin from '@/kernel/data/admin'
