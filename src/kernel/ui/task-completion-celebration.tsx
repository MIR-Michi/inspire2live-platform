'use client'

import { useEffect, useState } from 'react'
import { ConfettiBurst, type ConfettiOrigin } from '@/components/ui/confetti-burst'
import { useDesignSystem } from '@/kernel/ui/design-system-context'

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export type CelebrationOrigin = ConfettiOrigin

export function TaskCompletionCelebration({
  active,
  origin,
}: {
  active: boolean
  origin: CelebrationOrigin | null
}) {
  const design = useDesignSystem()
  const reducedMotion = useReducedMotion()

  if (!active) return null

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">Task completed.</span>
      <ConfettiBurst
        fireKey={1}
        count={20}
        origin={origin}
        disabled={!design.taskCelebration || reducedMotion}
      />
    </>
  )
}
