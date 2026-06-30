'use client'

import { useMemo, type CSSProperties } from 'react'

const COLORS = ['#d74247', '#e8981e', '#2aaa8a', '#3b82d6', '#a78bfa', '#fbbf24']

// Deterministic pseudo-random in [0,1) — pure (no Math.random/Date), so it's
// safe to use during render. Different (fireKey, index, salt) → different value.
function rand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A small, self-contained confetti burst — no dependencies. Increment `fireKey`
 * to fire a burst (e.g. when the last open task on a list is completed). Render
 * it inside a `position: relative` container; pieces radiate from its centre and
 * fade out via CSS (and are replaced on the next burst). Honours
 * prefers-reduced-motion via the CSS in globals.
 *
 * Pieces are a pure function of `fireKey`, and keying the wrapper on `fireKey`
 * restarts the CSS animation on each fire.
 */
export function ConfettiBurst({ fireKey, count = 28 }: { fireKey: number; count?: number }) {
  const pieces = useMemo(() => {
    if (fireKey === 0) return []
    return Array.from({ length: count }).map((_, i) => {
      const angle = rand(fireKey * 12.9898 + i * 78.233) * Math.PI * 2
      const dist = 60 + rand(fireKey * 39.346 + i * 11.135) * 130
      const style: CSSProperties = {
        left: '50%',
        top: '38%',
        backgroundColor: COLORS[i % COLORS.length],
        // CSS custom props consumed by the confetti-fall keyframes.
        ['--cx' as string]: `${Math.cos(angle) * dist}px`,
        ['--cy' as string]: `${Math.sin(angle) * dist + 70}px`,
        ['--cr' as string]: `${rand(fireKey * 7.421 + i * 53.71) * 540 - 270}deg`,
        animationDelay: `${Math.round(rand(fireKey * 95.21 + i * 4.17) * 70)}ms`,
      } as CSSProperties
      return { id: i, style }
    })
  }, [fireKey, count])

  if (pieces.length === 0) return null

  return (
    <div key={fireKey} className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece.id} className="confetti-piece" style={piece.style} />
      ))}
    </div>
  )
}
