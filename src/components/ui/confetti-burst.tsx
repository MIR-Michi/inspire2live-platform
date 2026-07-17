'use client'

import { useMemo, type CSSProperties } from 'react'

const COLORS = ['#d74247', '#e8981e', '#2aaa8a', '#3b82d6', '#a78bfa', '#fbbf24']

function rand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

export type ConfettiOrigin = { x: number; y: number }

/**
 * Small dependency-free confetti burst. By default it radiates from the centre
 * of a positioned parent. Pass a viewport `origin` for a global/localized burst
 * that survives the originating row being removed after a successful save.
 */
export function ConfettiBurst({
  fireKey,
  count = 28,
  origin,
  disabled = false,
}: {
  fireKey: number
  count?: number
  origin?: ConfettiOrigin | null
  disabled?: boolean
}) {
  const pieces = useMemo(() => {
    if (fireKey === 0 || disabled) return []
    return Array.from({ length: count }).map((_, index) => {
      const angle = rand(fireKey * 12.9898 + index * 78.233) * Math.PI * 2
      const distance = 60 + rand(fireKey * 39.346 + index * 11.135) * 130
      const style: CSSProperties = {
        left: origin ? `${origin.x}px` : '50%',
        top: origin ? `${origin.y}px` : '38%',
        backgroundColor: COLORS[index % COLORS.length],
        ['--cx' as string]: `${Math.cos(angle) * distance}px`,
        ['--cy' as string]: `${Math.sin(angle) * distance + 70}px`,
        ['--cr' as string]: `${rand(fireKey * 7.421 + index * 53.71) * 540 - 270}deg`,
        animationDelay: `${Math.round(rand(fireKey * 95.21 + index * 4.17) * 70)}ms`,
      } as CSSProperties
      return { id: index, style }
    })
  }, [count, disabled, fireKey, origin])

  if (pieces.length === 0) return null

  return (
    <div
      key={fireKey}
      className={origin ? 'pointer-events-none fixed inset-0 z-[100] overflow-hidden' : 'pointer-events-none absolute inset-0 z-20 overflow-visible'}
      aria-hidden="true"
    >
      {pieces.map((piece) => <span key={piece.id} className="confetti-piece" style={piece.style} />)}
    </div>
  )
}
