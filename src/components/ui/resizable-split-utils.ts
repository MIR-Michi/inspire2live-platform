/**
 * Pure math + storage helpers for the ResizableSplit component. Kept free of
 * React/DOM so the clamping, template, keyboard-step, and persistence logic can
 * be unit-tested directly.
 *
 * `ratio` is the LEFT column's fraction of the available width, in (0, 1).
 */

export const DEFAULT_MIN_RATIO = 0.2
export const DEFAULT_MAX_RATIO = 0.8
export const DEFAULT_HANDLE_PX = 12

/** Clamp a ratio into [min, max]; non-finite input falls back to the midpoint. */
export function clampRatio(ratio: number, min = DEFAULT_MIN_RATIO, max = DEFAULT_MAX_RATIO): number {
  if (!Number.isFinite(ratio)) return (min + max) / 2
  return Math.min(max, Math.max(min, ratio))
}

/** Round to 4 decimals so persisted/rendered values stay stable. */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 10000) / 10000
}

/**
 * CSS grid-template-columns value: `minmax(0, Lfr) <handle>px minmax(0, Rfr)`.
 * `minmax(0, …)` lets both panels shrink below their content size so internal
 * scroll regions (feeds, tables) keep working.
 */
export function columnsTemplate(ratio: number, handlePx = DEFAULT_HANDLE_PX, min = DEFAULT_MIN_RATIO, max = DEFAULT_MAX_RATIO): string {
  const left = roundRatio(clampRatio(ratio, min, max))
  const right = roundRatio(1 - left)
  return `minmax(0, ${left}fr) ${handlePx}px minmax(0, ${right}fr)`
}

/** Ratio from a pointer x within the container's bounding box. */
export function ratioFromPointer(
  clientX: number,
  rect: { left: number; width: number },
  min = DEFAULT_MIN_RATIO,
  max = DEFAULT_MAX_RATIO
): number {
  if (!rect.width) return (min + max) / 2
  return clampRatio((clientX - rect.left) / rect.width, min, max)
}

/** Nudge the ratio by `delta`, clamped. */
export function stepRatio(ratio: number, delta: number, min = DEFAULT_MIN_RATIO, max = DEFAULT_MAX_RATIO): number {
  return roundRatio(clampRatio(ratio + delta, min, max))
}

/** Parse a persisted ratio string; returns null when unusable. */
export function parseStoredRatio(raw: string | null | undefined, min = DEFAULT_MIN_RATIO, max = DEFAULT_MAX_RATIO): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return clampRatio(n, min, max)
}

/** localStorage key namespaced so callers only pass a short id. */
export function storageKeyFor(id: string): string {
  return `i2l:split:${id}`
}
