/**
 * Governance check #3 — reachability (ADR-0009 §10).
 *
 * A component with UI must be reachable, not a zombie. At Stage 1 this enforces
 * surface/UI consistency (a UI-providing component cannot be `headless`; a
 * `headless` component ships no UI) and that every `public` component has a
 * public route on disk. Nav-mount verification from manifests is Stage 3 (shell
 * composition) and is noted, not yet enforced.
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { componentManifests } from '@/modules/registry'

const APP = resolve(__dirname, '../../../src/app')

describe('reachability', () => {
  it('a component that provides UI is not headless', () => {
    const bad = componentManifests
      .filter((m) => (m.provides?.ui?.length ?? 0) > 0 && m.surface === 'headless')
      .map((m) => m.id)
    expect(bad, `headless components that ship UI: ${bad.join(', ')}`).toEqual([])
  })

  it('a headless component ships no UI', () => {
    const bad = componentManifests
      .filter((m) => m.surface === 'headless' && (m.provides?.ui?.length ?? 0) > 0)
      .map((m) => m.id)
    expect(bad).toEqual([])
  })

  it('an internal/public component declares at least one UI surface', () => {
    const bad = componentManifests
      .filter((m) => m.surface !== 'headless' && (m.provides?.ui?.length ?? 0) === 0)
      .map((m) => m.id)
    expect(bad, `non-headless components with no declared UI: ${bad.join(', ')}`).toEqual([])
  })

  it('every public component has a public route on disk', () => {
    // Map component id → public route dir under src/app. Empty today: the only
    // public component (stories) was retired. Add an entry when a public
    // component is introduced.
    const publicRoutes: Record<string, string> = {}
    const missing = componentManifests
      .filter((m) => m.surface === 'public')
      .filter((m) => {
        const route = publicRoutes[m.id]
        return !route || !existsSync(resolve(APP, route))
      })
      .map((m) => m.id)
    expect(missing, `public components without a route: ${missing.join(', ')}`).toEqual([])
  })
})
