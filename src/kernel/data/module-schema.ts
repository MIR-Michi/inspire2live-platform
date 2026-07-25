/**
 * kernel/data/module-schema.ts
 *
 * A typed accessor for tables a component owns but that are not (yet) in the
 * generated `src/types/database.ts`.
 *
 * The problem this solves: `src/types/database.ts` is regenerated from a live
 * database, so a component that ships a migration in the same change has no
 * generated types for its own tables until someone runs the generator against a
 * migrated database. The historical workaround — `(supabase as any)` at every
 * call site — is explicitly banned by AGENTS.md §11, and rightly: it turns off
 * type-checking for the whole query, not just the table name.
 *
 * The rule instead: a component declares the row shapes it owns (it is the
 * owner — ADR-0009 §3 — so it is the right place for that declaration) and gets
 * a fully typed client for them from here. There is exactly **one** cast, it is
 * in the kernel, and it is documented. When the generator next runs, a component
 * can delete its declaration and switch to the generated types with no call-site
 * churn.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** One owned table's Row / Insert / Update shapes. */
export type ModuleTable<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

/** One published read view (`security_invoker`) — read-only by construction. */
export type ModuleView<Row> = {
  Row: Row
  Relationships: []
}

/**
 * A `Database`-shaped type covering only the tables/views one component owns.
 * Compose with `ModuleTable` / `ModuleView`, e.g.
 *
 * ```ts
 * type NetworkDb = ModuleDatabase<{ network_people: ModuleTable<PersonRow> }>
 * ```
 */
export type ModuleDatabase<
  TTables extends Record<string, ModuleTable<Record<string, unknown>, unknown, unknown>>,
  TViews extends Record<string, ModuleView<Record<string, unknown>>> = Record<never, never>,
> = {
  public: {
    Tables: TTables
    Views: TViews
    // `Record<never, never>` — an empty record — not `Record<string, never>`.
    // The latter declares that *every* string key exists with type `never`,
    // which makes PostgREST's table/view resolution ambiguous and collapses
    // every `select()` result to `{}`. This is the difference between "there are
    // no views" and "every possible view exists and is unusable".
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

/**
 * Re-type an existing Supabase client against a component's own schema.
 *
 * This changes only the *types*: the same client, the same auth context, the
 * same RLS. It never widens access — a component that types a table it does not
 * own still gets nothing back, because the policy decides, not the type.
 */
export function moduleClient<TDatabase>(client: unknown): SupabaseClient<TDatabase> {
  // The single, deliberate cast (see the file header). Callers stay fully typed.
  return client as SupabaseClient<TDatabase>
}
