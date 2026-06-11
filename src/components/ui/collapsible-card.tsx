'use client'

import { useEffect, useState } from 'react'

interface CollapsibleCardProps {
  /** Heading shown in the always-visible header bar. */
  title: React.ReactNode
  /**
   * Stable key for persisting collapsed state across reloads (localStorage).
   * Omit to make the card uncontrolled/non-persistent.
   */
  storageKey?: string
  /** Initial state before any persisted value is read. */
  defaultCollapsed?: boolean
  /** Optional content on the right of the header (links, counts, badges). */
  actions?: React.ReactNode
  /** Card border accent (ignored for the `plain` variant). */
  tone?: 'neutral' | 'orange'
  /**
   * Visual style:
   * - `card` (default): a bordered, padded tile — best for boxed dashboard tiles.
   * - `plain`: no card chrome, larger heading — best for full-width section groups
   *   that already contain their own cards/tables (avoids nested borders).
   */
  variant?: 'card' | 'plain'
  /** Extra classes for the outer wrapper. */
  className?: string
  /** Extra classes for the body wrapper. */
  bodyClassName?: string
  /** Override the title typography (defaults depend on variant). */
  titleClassName?: string
  children: React.ReactNode
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={[
        'h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200',
        collapsed ? '-rotate-90' : '',
      ].join(' ')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

/**
 * A titled card whose body can be collapsed/expanded. The header bar (title +
 * chevron) is always visible; clicking it toggles the body. When `storageKey` is
 * provided the collapsed state is remembered per user via localStorage so a tidied
 * dashboard stays tidy across reloads.
 *
 * Reusable across any section-heavy surface (dashboards, congress workspace,
 * initiative detail, …) for a cleaner, scannable layout.
 */
export function CollapsibleCard({
  title,
  storageKey,
  defaultCollapsed = false,
  actions,
  tone = 'neutral',
  variant = 'card',
  className,
  bodyClassName,
  titleClassName,
  children,
}: CollapsibleCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // Read any persisted preference after hydration (keeps SSR markup stable).
  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = window.localStorage.getItem(`collapse:${storageKey}`)
      // Sync from persisted prefs once mounted; intentionally post-hydration so the
      // SSR markup stays stable (defaultCollapsed) and matches the first client render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== null) setCollapsed(stored === '1')
    } catch {
      /* localStorage unavailable — fall back to defaultCollapsed */
    }
  }, [storageKey])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (storageKey) {
        try {
          window.localStorage.setItem(`collapse:${storageKey}`, next ? '1' : '0')
        } catch {
          /* ignore write failures */
        }
      }
      return next
    })
  }

  const bodyId = storageKey ? `collapsible-${storageKey}` : undefined
  const plain = variant === 'plain'

  return (
    <section
      className={[
        plain
          ? ''
          : `rounded-xl border bg-white shadow-sm ${tone === 'orange' ? 'border-orange-200' : 'border-neutral-200'}`,
        className ?? '',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center justify-between gap-3',
          plain ? 'mb-3' : 'px-4 py-3',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Chevron collapsed={collapsed} />
          <span
            className={
              titleClassName ??
              (plain ? 'text-base font-semibold text-neutral-900' : 'text-sm font-semibold text-neutral-900')
            }
          >
            {title}
          </span>
        </button>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div
        id={bodyId}
        hidden={collapsed}
        className={[plain ? '' : 'px-4 pb-4', bodyClassName ?? ''].join(' ')}
      >
        {children}
      </div>
    </section>
  )
}
