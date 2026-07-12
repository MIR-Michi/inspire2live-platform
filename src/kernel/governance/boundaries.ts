/**
 * kernel/governance/boundaries.ts
 *
 * Import-boundary rule (ADR-0009 §9/§10, governance check #1), expressed as a
 * pure function so it can be both run over the repo and unit-tested with
 * synthetic fixtures.
 *
 * The rule: a component may import the kernel and another component's package
 * root (its `index.ts`) — never another component's internals; and the kernel
 * may never import a component.
 */

/** Which module a `src/...` file belongs to. */
export function ownerOf(file: string): { layer: 'kernel' | 'module' | 'other'; id?: string } {
  const mod = file.match(/(?:^|\/)src\/modules\/([^/]+)\//)
  if (mod) return { layer: 'module', id: mod[1] }
  if (/(?:^|\/)src\/kernel\//.test(file)) return { layer: 'kernel' }
  return { layer: 'other' }
}

export type BoundaryViolation = { file: string; importPath: string; reason: string }

/**
 * Classify a single import. Returns null when allowed, or a reason string when it
 * breaches a boundary.
 */
export function classifyImport(fromFile: string, importPath: string): string | null {
  const from = ownerOf(fromFile)

  // Kernel must not depend on any component.
  if (from.layer === 'kernel' && /^@\/modules\//.test(importPath)) {
    return 'kernel must not import a component (@/modules/*)'
  }

  if (from.layer === 'module') {
    const m = importPath.match(/^@\/modules\/([^/]+)(\/.*)?$/)
    if (m) {
      const targetId = m[1]
      const deep = m[2]
      if (targetId !== from.id && deep && deep !== '/index') {
        return `deep import into another component's internals (@/modules/${targetId}${deep}); import '@/modules/${targetId}' instead`
      }
    }
  }

  return null
}

/** Run the rule over a set of (file, importPath) pairs. */
export function findBoundaryViolations(
  imports: ReadonlyArray<{ file: string; importPath: string }>,
): BoundaryViolation[] {
  const out: BoundaryViolation[] = []
  for (const { file, importPath } of imports) {
    const reason = classifyImport(file, importPath)
    if (reason) out.push({ file, importPath, reason })
  }
  return out
}
