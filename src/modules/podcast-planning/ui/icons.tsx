/**
 * podcast-planning/ui/icons.tsx — the planner's pictographic vocabulary.
 *
 * The 2026-08 UX pass replaced most explanatory sentences with icons + one-word
 * labels, so the icon *is* the meaning and has to stay consistent everywhere it
 * appears: the same glyph for a stage on the nav, on a column header, on the
 * stepper and on a button. Stroke-based, currentColor, sized by the caller.
 */

import type { CandidateStage } from '@/modules/podcast-planning/domain/types'

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-4 w-4'}
    >
      {children}
    </svg>
  )
}

export function IconWishlist({ className }: { className?: string }) {
  // A simple list — names written down, nothing more.
  return (
    <Svg className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  )
}

export function IconResearch({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </Svg>
  )
}

export function IconAsk({ className }: { className?: string }) {
  // Paper plane — the request is out.
  return (
    <Svg className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </Svg>
  )
}

export function IconPlanning({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  )
}

export function IconBooked({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </Svg>
  )
}

export function IconRecorded({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3" />
    </Svg>
  )
}

export function IconSleep({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </Svg>
  )
}

export function IconClose({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  )
}

export function IconClock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  )
}

export function IconArrowRight({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  )
}

export function IconArrowLeft({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  )
}

export function IconStar({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-4 w-4'}
    >
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  )
}

export function IconChevron({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  )
}

export function IconQuestion({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.34c-.75.29-1.4.91-1.4 1.71V14" />
      <path d="M12 17h.01" />
    </Svg>
  )
}

export function IconPeople({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4a6.5 6.5 0 0 1 4 5.6" />
    </Svg>
  )
}

export function IconHandshake({ className }: { className?: string }) {
  // Two joined hands, simplified: introductions.
  return (
    <Svg className={className}>
      <path d="m11 17 2 2a2.12 2.12 0 0 0 3-3" />
      <path d="m14 14 2.5 2.5a2.12 2.12 0 0 0 3-3L16 10l-2.6-2.6a3 3 0 0 0-4.24 0L8 8.56 5.5 6" />
      <path d="M2 9.5 7 5l2.5 2" />
      <path d="m2 15 4 4a2.12 2.12 0 0 0 3-3" />
    </Svg>
  )
}

export function IconBoard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18" />
    </Svg>
  )
}

export function IconRadar({ className }: { className?: string }) {
  // Concentric sweeps around a fixed point: something is being watched for.
  return (
    <Svg className={className}>
      <path d="M12 12v-9" />
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </Svg>
  )
}

export function IconOverride({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  )
}

/** One glyph per stage — used by columns, the stepper and the next-move button. */
export const STAGE_ICONS: Record<CandidateStage, (props: { className?: string }) => React.JSX.Element> = {
  wishlist: IconWishlist,
  research: IconResearch,
  ask: IconAsk,
  planning: IconPlanning,
  booked: IconBooked,
  recorded: IconRecorded,
  not_now: IconSleep,
  closed: IconClose,
}

/** Initials avatar — the visual anchor for a person, everywhere in the planner. */
export function InitialsAvatar({ name, className }: { name: string | null; className?: string }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
  // Stable hue from the name, so the same person is the same colour everywhere.
  let hash = 0
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hues = [
    'bg-orange-100 text-orange-800',
    'bg-blue-100 text-blue-800',
    'bg-emerald-100 text-emerald-800',
    'bg-violet-100 text-violet-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
  ]
  const tone = hues[Math.abs(hash) % hues.length]
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        tone,
        className ?? 'h-8 w-8 text-xs',
      ].join(' ')}
    >
      {initials || '?'}
    </span>
  )
}
