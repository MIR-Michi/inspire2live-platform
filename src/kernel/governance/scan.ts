/**
 * kernel/governance/scan.ts
 *
 * Tiny filesystem import scanner shared by the governance checks. Build/CI-time
 * only (node:fs); never imported by app runtime.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC_EXT = /\.(ts|tsx)$/
const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/** Recursively list .ts/.tsx files under a directory (skips node_modules). */
export function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (SRC_EXT.test(entry)) out.push(full)
    }
  }
  walk(dir)
  return out
}

/** Extract every import specifier from the given files. */
export function scanImports(
  files: string[],
): Array<{ file: string; importPath: string }> {
  const out: Array<{ file: string; importPath: string }> = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2]
      if (spec) out.push({ file, importPath: spec })
    }
  }
  return out
}
