'use client'

/**
 * kernel/ui/character-ring.tsx — a ring that fills toward a character budget
 * and changes tone as it approaches it. No sentence needed to explain a limit
 * (ADR-0014 UX rule: affordances instead of instructions).
 *
 * Tone: neutral → amber at 85% → red over budget.
 */

export function CharacterRing({
  count,
  budget,
  size = 30,
}: {
  count: number
  budget: number
  size?: number
}) {
  const safeBudget = budget > 0 ? budget : 1
  const ratio = count / safeBudget
  const shown = Math.min(ratio, 1)
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const tone = ratio > 1 ? 'text-red-500' : ratio >= 0.85 ? 'text-amber-500' : 'text-emerald-500'
  const over = count - safeBudget

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={ratio > 1 ? `${over} character${over === 1 ? '' : 's'} over the ${safeBudget} budget` : `${count} / ${safeBudget} characters`}
      role="img"
      aria-label={`${count} of ${safeBudget} characters used`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-neutral-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          className={`${tone} stroke-current transition-all duration-300`}
        />
      </svg>
      <span className={`text-[11px] font-semibold tabular-nums ${ratio > 1 ? 'text-red-600' : 'text-neutral-400'}`}>
        {ratio > 1 ? `+${over}` : count}
      </span>
    </span>
  )
}
