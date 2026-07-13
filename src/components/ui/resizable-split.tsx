'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_HANDLE_PX,
  DEFAULT_MAX_RATIO,
  DEFAULT_MIN_RATIO,
  clampRatio,
  columnsTemplate,
  parseStoredRatio,
  ratioFromPointer,
  stepRatio,
  storageKeyFor,
} from './resizable-split-utils'

const KEYBOARD_STEP = 0.02

/**
 * Two-column layout with a draggable divider. Below `lg` the columns stack and
 * the divider is hidden (CSS-only, no JS) so there is no hydration flash. The
 * chosen ratio is persisted per `storageKey` in localStorage.
 *
 * Panels are `min-w-0` so content (feeds, tables) can shrink and scroll inside
 * their track rather than forcing the whole layout wider.
 */
export function ResizableSplit({
  storageKey,
  left,
  right,
  defaultRatio = 0.66,
  minRatio = DEFAULT_MIN_RATIO,
  maxRatio = DEFAULT_MAX_RATIO,
  handlePx = DEFAULT_HANDLE_PX,
  className = '',
  ariaLabel = 'Resize columns',
}: {
  storageKey: string
  left: ReactNode
  right: ReactNode
  defaultRatio?: number
  minRatio?: number
  maxRatio?: number
  handlePx?: number
  className?: string
  ariaLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [ratio, setRatio] = useState(() => clampRatio(defaultRatio, minRatio, maxRatio))
  const [dragging, setDragging] = useState(false)

  // Load the persisted ratio after mount (SSR renders the default — no mismatch).
  useEffect(() => {
    try {
      const stored = parseStoredRatio(window.localStorage.getItem(storageKeyFor(storageKey)), minRatio, maxRatio)
      // Read-after-mount is the SSR-safe initialization pattern here (server
      // renders the default; client hydrates it, then adopts the stored value).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored != null) setRatio(stored)
    } catch {
      /* localStorage unavailable — keep the default */
    }
  }, [storageKey, minRatio, maxRatio])

  const persist = useCallback(
    (value: number) => {
      try {
        window.localStorage.setItem(storageKeyFor(storageKey), String(value))
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setRatio(ratioFromPointer(event.clientX, rect, minRatio, maxRatio))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* not captured */
    }
    persist(ratio)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = stepRatio(ratio, -KEYBOARD_STEP, minRatio, maxRatio)
    else if (event.key === 'ArrowRight') next = stepRatio(ratio, KEYBOARD_STEP, minRatio, maxRatio)
    else if (event.key === 'Home') next = minRatio
    else if (event.key === 'End') next = maxRatio
    if (next == null) return
    event.preventDefault()
    setRatio(next)
    persist(next)
  }

  const reset = () => {
    const value = clampRatio(defaultRatio, minRatio, maxRatio)
    setRatio(value)
    persist(value)
  }

  return (
    <div
      ref={containerRef}
      style={{ ['--split-cols' as string]: columnsTemplate(ratio, handlePx, minRatio, maxRatio) }}
      className={`grid grid-cols-1 gap-6 lg:gap-0 lg:[grid-template-columns:var(--split-cols)] ${dragging ? 'select-none' : ''} ${className}`.trim()}
    >
      <div className="min-w-0 min-h-0">{left}</div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={ariaLabel}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={reset}
        title="Drag to resize · double-click to reset"
        className={`group hidden lg:flex lg:cursor-col-resize lg:items-center lg:justify-center lg:self-stretch ${
          dragging ? 'touch-none' : ''
        }`}
      >
        <span
          className={`h-16 w-1 rounded-full transition-colors ${
            dragging ? 'bg-orange-500' : 'bg-neutral-200 group-hover:bg-orange-400 group-focus:bg-orange-400'
          }`}
        />
      </div>
      <div className="min-w-0 min-h-0">{right}</div>
    </div>
  )
}
