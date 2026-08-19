/**
 * Governance check #4 — dead-code scan (ADR-0009 §10).
 *
 * Standing version of the Sprint-15 S15-T06 pass: every file under src/lib and
 * src/components must be referenced by an import somewhere in src. A zero-
 * reference file is dead code and fails CI, so orphans can't re-accumulate.
 *
 * Scope is the legacy surface (lib + components) where dead code accretes; app/
 * router entrypoints and the module/kernel scaffolds are excluded (they are
 * entrypoints or wired via the registry). A dependency-free stand-in for `knip`.
 */

import { describe, it, expect } from 'vitest'
import { resolve, relative, sep } from 'node:path'
import { listSourceFiles, scanImports } from '@/kernel/governance/scan'

const SRC = resolve(__dirname, '../../../src')

function stem(file: string): string {
  return file.replace(/\.(ts|tsx)$/, '')
}

/**
 * Import specifiers are always `/`-separated; `path.relative` is not. Without
 * this the scan builds `@/lib\notify` on Windows, matches nothing, and reports
 * every file in the scope as dead.
 */
function toPosix(p: string): string {
  return p.split(sep).join('/')
}

describe('dead-code scan (lib + components)', () => {
  it('has no zero-reference files', () => {
    const candidates = [
      ...listSourceFiles(resolve(SRC, 'lib')),
      ...listSourceFiles(resolve(SRC, 'components')),
    ].filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f))

    // Every import specifier anywhere in src.
    const allFiles = listSourceFiles(SRC)
    const imports = scanImports(allFiles).map((i) => i.importPath)

    // Referenced by @/-alias path (primary) or by a relative path ending in the
    // file's stem (fallback for ./ and ../ imports).
    const aliasPaths = new Set(imports.filter((p) => p.startsWith('@/')))
    const importEndings = new Set(imports.map((p) => p.replace(/^.*\//, ''))) // last segment

    const orphans = candidates.filter((file) => {
      const rel = toPosix(relative(SRC, stem(file))) // e.g. lib/notify  or  components/ui/button
      const alias = '@/' + rel
      if (aliasPaths.has(alias)) return false
      const base = rel.replace(/^.*\//, '')
      if (importEndings.has(base)) return false
      return true
    })

    const msg = orphans.map((f) => toPosix(relative(SRC, f))).sort().join('\n')
    expect(orphans, `zero-reference files (dead code — remove or wire up):\n${msg}`).toEqual([])
  })
})
