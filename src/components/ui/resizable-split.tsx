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
 * chosen ratio is persisted per `storageKey` by default.
 *
 * Sprint 19 adds an optional controlled mode (`ratio` + callbacks) so durable
 * user dashboard preferences can remain authoritative across devices while all
 * existing localStorage-only surfaces keep their current behavior.
 */
export function ResizableSplit({
  storageKey,
  left,
  right,
  defaultRatio = 0.66,
  ratio: controlledRatio,
  onRatioChange,
  onRatioCommit,
  persistLocal = true,
  minRatio = DEFAULT_MIN_RATIO,
  maxRatio = DEFAULT_MAX_RATIO,
  handlePx,
  className = '',
  ariaLabel = 'Resize columns',
  variant = 'gap',
}: {
  storageKey: string
  left: ReactNode
  right: ReactNode
  defaultRatio?: number
  /** Controlled ratio. Omit to retain the original internal/localStorage mode. */
  ratio?: number
  /** Fires while pointer or keyboard resizing changes the controlled ratio. */
  onRatioChange?: (ratio: number) => void
  /** Fires after pointer/key/reset interaction completes; suitable for persistence. */
  onRatioCommit?: (ratio: number) => void
  /** Keep the historical localStorage cache. Disable only when a parent owns it. */
  persistLocal?: boolean
  minRatio?: number
  maxRatio?: number
  handlePx?: number
  className?: string
  ariaLabel?: string
  variant?: 'gap' | 'seam'
}) {
  const seam = variant === 'seam'
  const effectiveHandlePx = handlePx ?? (seam ? 9 : DEFAULT_HANDLE_PX)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [internalRatio, setInternalRatio] = useState(() => clampRatio(defaultRatio, minRatio, maxRatio))
  const [dragging, setDragging] = useState(false)
  const ratio = clampRatio(controlledRatio ?? internalRatio, minRatio, maxRatio)
  const controlled = controlledRatio !== undefined

  useEffect(() => {
    if (controlled || !persistLocal) return
    try {
      const stored = parseStoredRatio(window.localStorage.getItem(storageKeyFor(storageKey)), minRatio, maxRatio)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored != null) setInternalRatio(stored)
    } catch {
      /* localStorage unavailable — keep the default */
    }
  }, [controlled, maxRatio, minRatio, persistLocal, storageKey])

  const persist = useCallback(
    (value: number) => {
      if (!persistLocal) return
      try {
        window.localStorage.setItem(storageKeyFor(storageKey), String(value))
      } catch {
        /* ignore */
      }
    },
    [persistLocal, storageKey],
  )

  const change = (value: number) => {
    const next = clampRatio(value, minRatio, maxRatio)
    if (!controlled) setInternalRatio(next)
    onRatioChange?.(next)
    return next
  }

  const commit = (value: number) => {
    const next = clampRatio(value, minRatio, maxRatio)
    persist(next)
    onRatioCommit?.(next)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    change(ratioFromPointer(event.clientX, rect, minRatio, maxRatio))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* not captured */
    }
    commit(ratio)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = stepRatio(ratio, -KEYBOARD_STEP, minRatio, maxRatio)
    else if (event.key === 'ArrowRight') next = stepRatio(ratio, KEYBOARD_STEP, minRatio, maxRatio)
    else if (event.key === 'Home') next = minRatio
    else if (event.key === 'End') next = maxRatio
    if (next == null) return
    event.preventDefault()
    const changed = change(next)
    commit(changed)
  }

  const reset = () => {
    const value = change(defaultRatio)
    commit(value)
  }

  const gapClass = seam ? 'gap-0' : 'gap-6 lg:gap-0'
  return (
    <div
      ref={containerRef}
      style={{ ['--split-cols' as string]: columnsTemplate(ratio, effectiveHandlePx, minRatio, maxRatio) }}
      className={`grid grid-cols-1 ${gapClass} lg:[grid-template-columns:var(--split-cols)] ${dragging ? 'select-none' : ''} ${className}`.trim()}
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
        className={`group hidden lg:flex lg:cursor-col-resize lg:items-center lg:justify-center lg:self-stretch ${dragging ? 'touch-none' : ''}`}
      >
        {seam ? (
          <span className={`h-full w-px transition-colors ${dragging ? 'bg-orange-500' : 'bg-neutral-200 group-hover:bg-orange-400 group-focus:bg-orange-400'}`} />
        ) : (
          <span className={`h-16 w-1 rounded-full transition-colors ${dragging ? 'bg-orange-500' : 'bg-neutral-200 group-hover:bg-orange-400 group-focus:bg-orange-400'}`} />
        )}
      </div>
      <div className="min-w-0 min-h-0">{right}</div>
    </div>
  )
}
