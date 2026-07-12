/**
 * PresenterAvatar — shows a presenter's uploaded portrait, or a friendly,
 * slightly humorous generic avatar when no picture is available yet. Pure
 * presentational (no hooks), so it works in both server and client components.
 *
 * The generic avatar's colour and expression are derived deterministically from
 * the name (or a fallback seed), so the same presenter always gets the same
 * cheerful face.
 */

const BG_COLORS = ['#FDE68A', '#BFDBFE', '#C7D2FE', '#FBCFE8', '#A7F3D0', '#FED7AA', '#DDD6FE', '#BAE6FD']
const FACE = '#1f2937'

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

/** A handful of friendly expressions; one is picked deterministically. */
function Face({ variant }: { variant: number }) {
  const eyes = (() => {
    switch (variant % 4) {
      case 1: // wink
        return (
          <>
            <line x1="22" y1="27" x2="28" y2="27" stroke={FACE} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="42" cy="27" r="2.6" fill={FACE} />
          </>
        )
      case 2: // happy closed eyes
        return (
          <>
            <path d="M21 28 q4 -5 8 0" fill="none" stroke={FACE} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M35 28 q4 -5 8 0" fill="none" stroke={FACE} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )
      case 3: // surprised
        return (
          <>
            <circle cx="25" cy="27" r="3.2" fill={FACE} />
            <circle cx="42" cy="27" r="3.2" fill={FACE} />
          </>
        )
      default: // normal dots
        return (
          <>
            <circle cx="25" cy="27" r="2.6" fill={FACE} />
            <circle cx="42" cy="27" r="2.6" fill={FACE} />
          </>
        )
    }
  })()

  const mouth = (() => {
    switch (variant % 3) {
      case 1: // big grin
        return <path d="M22 38 q11 12 22 0 q-11 6 -22 0 Z" fill={FACE} />
      case 2: // small smile
        return <path d="M26 39 q7 6 14 0" fill="none" stroke={FACE} strokeWidth="2.5" strokeLinecap="round" />
      default: // open smile
        return <path d="M24 38 q9 10 18 0" fill="none" stroke={FACE} strokeWidth="3" strokeLinecap="round" />
    }
  })()

  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-hidden="true">
      {/* cheeks for a touch of warmth */}
      <circle cx="18" cy="36" r="4" fill="#fb7185" opacity="0.35" />
      <circle cx="49" cy="36" r="4" fill="#fb7185" opacity="0.35" />
      {eyes}
      {mouth}
    </svg>
  )
}

export function PresenterAvatar({
  src,
  name,
  className = 'h-12 w-12',
  rounded = 'rounded-lg',
}: {
  src?: string | null
  name?: string | null
  className?: string
  rounded?: string
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'Presenter'}
        className={`${className} ${rounded} border border-neutral-200 object-cover`}
      />
    )
  }

  const seed = (name && name.trim()) || 'campus-presenter'
  const h = hashSeed(seed)
  const bg = BG_COLORS[h % BG_COLORS.length]

  return (
    <div
      className={`${className} ${rounded} flex items-center justify-center overflow-hidden border border-neutral-200`}
      style={{ backgroundColor: bg }}
      title={name || 'Presenter — no photo yet'}
    >
      <Face variant={h} />
    </div>
  )
}
