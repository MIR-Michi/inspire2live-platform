'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useDesignSystem } from './design-system-context'

const PARTICLES = Array.from({ length: 18 }, (_, index) => ({
  angle: (index / 18) * Math.PI * 2,
  distance: 34 + (index % 5) * 8,
  rotate: (index * 47) % 300,
  delay: (index % 4) * 18,
}))

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

export type CelebrationOrigin = { x: number; y: number }

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

  const x = origin?.x ?? (typeof window === 'undefined' ? 0 : window.innerWidth / 2)
  const y = origin?.y ?? (typeof window === 'undefined' ? 0 : window.innerHeight / 2)
  const particlesEnabled = design.taskCelebration && !reducedMotion

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">Task completed.</span>
      {particlesEnabled && (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
          {PARTICLES.map((particle, index) => {
            const dx = Math.cos(particle.angle) * particle.distance
            const dy = Math.sin(particle.angle) * particle.distance - 18
            const style = {
              left: x,
              top: y,
              '--confetti-x': `${dx}px`,
              '--confetti-y': `${dy}px`,
              '--confetti-r': `${particle.rotate}deg`,
              animationDelay: `${particle.delay}ms`,
            } as CSSProperties
            return (
              <span
                key={index}
                style={style}
                className={[
                  'absolute h-2 w-1.5 rounded-sm i2l-confetti-particle',
                  index % 4 === 0 ? 'bg-orange-500' : index % 4 === 1 ? 'bg-emerald-500' : index % 4 === 2 ? 'bg-blue-500' : 'bg-violet-500',
                ].join(' ')}
              />
            )
          })}
        </div>
      )}
      <style>{`
        @keyframes i2l-confetti-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.5) rotate(0deg); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--confetti-x)), calc(-50% + var(--confetti-y) + 28px)) scale(1) rotate(var(--confetti-r)); }
        }
        .i2l-confetti-particle { animation: i2l-confetti-burst 760ms cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .i2l-confetti-particle { display: none; } }
      `}</style>
    </>
  )
}
