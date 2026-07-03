/**
 * Governance check #1 — module import boundaries (ADR-0009 §9/§10).
 *
 * Asserts no file under src/modules or src/kernel reaches past another module's
 * public `index.ts`, and the kernel never imports a component. Includes a
 * fixture proving the rule fails a deliberate violation.
 */

import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { listSourceFiles, scanImports } from '@/kernel/governance/scan'
import { classifyImport, findBoundaryViolations } from '@/kernel/governance/boundaries'

const SRC = resolve(__dirname, '../../../src')

describe('module import boundaries', () => {
  it('the live tree has zero boundary violations', () => {
    const files = [
      ...listSourceFiles(resolve(SRC, 'modules')),
      ...listSourceFiles(resolve(SRC, 'kernel')),
    ]
    const violations = findBoundaryViolations(scanImports(files))
    const msg = violations.map((v) => `${v.file}: ${v.importPath} — ${v.reason}`).join('\n')
    expect(violations, msg).toEqual([])
  })

  // Fixtures: prove the rule actually catches violations (S16-T03a).
  it('flags a deep import into another component', () => {
    expect(
      classifyImport('/x/src/modules/intake/domain/x.ts', '@/modules/contacts/domain/repository'),
    ).toMatch(/deep import/)
  })

  it('flags the kernel importing a component', () => {
    expect(classifyImport('/x/src/kernel/rbac/index.ts', '@/modules/contacts')).toMatch(/kernel must not/)
  })

  it('allows importing another component package root', () => {
    expect(classifyImport('/x/src/modules/intake/index.ts', '@/modules/contacts')).toBeNull()
  })

  it('allows a component importing the kernel and its own internals', () => {
    expect(classifyImport('/x/src/modules/intake/api/route.ts', '@/kernel/notifications')).toBeNull()
    expect(classifyImport('/x/src/modules/intake/api/route.ts', '@/modules/intake/domain/repo')).toBeNull()
  })
})
