/**
 * kernel/db/live-tables.ts
 *
 * Derives the set of tables that currently exist by statically reading the
 * migration history (CREATE TABLE minus DROP TABLE). This is the DB-free
 * "exists" source for the table-ownership reconciliation check (ADR-0009 §10) —
 * it needs no live database connection, so it runs in any CI job.
 *
 * Build/CI-time utility only: uses node:fs and is never imported by app runtime.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CREATE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi
const DROP_RE = /drop\s+table\s+(?:if\s+exists\s+)?([\s\S]*?);/gi
const IDENT_RE = /(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi
const DROP_KEYWORDS = new Set(['if', 'exists', 'cascade', 'restrict', 'public'])

/** Compute { created, dropped, live } table sets from a migrations directory. */
export function readMigrationTables(migrationsDir: string): {
  created: Set<string>
  dropped: Set<string>
  live: Set<string>
} {
  const created = new Set<string>()
  const dropped = new Set<string>()

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const raw = readFileSync(join(migrationsDir, file), 'utf8')
    // Strip comments so prose like "-- create table X was retired" can't be
    // mistaken for DDL.
    const sql = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

    for (const m of sql.matchAll(CREATE_RE)) created.add(m[1])

    // DROP TABLE [IF EXISTS] a, b, c CASCADE;  — may span multiple lines.
    for (const drop of sql.matchAll(DROP_RE)) {
      const body = drop[1]
      for (const id of body.matchAll(IDENT_RE)) {
        const name = id[1]
        if (!DROP_KEYWORDS.has(name)) dropped.add(name)
      }
    }
  }

  const live = new Set<string>()
  for (const t of created) if (!dropped.has(t)) live.add(t)

  return { created, dropped, live }
}
