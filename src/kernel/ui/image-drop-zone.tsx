'use client'

/**
 * kernel/ui/image-drop-zone.tsx — a file-accepting surface: drag, click,
 * paste, thumbnail, remove; keyboard-accessible. Built in the kernel rather
 * than a module because the next feature that accepts a file wants it too
 * (ADR-0014, consequence: the design system had no file-input primitive).
 *
 * Controlled: the parent owns the selected file; this component only reports
 * `onSelect` / `onClear` and renders the affordance + preview.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type ImageDropZoneValue = {
  name: string
  /** An object URL or signed URL for the thumbnail. */
  previewUrl: string
}

export function ImageDropZone({
  value,
  onSelect,
  onClear,
  accept = ['image/png', 'image/jpeg', 'image/webp'],
  disabled = false,
  label = 'Drop a screenshot',
  hint = 'or click to choose · paste works too',
}: {
  value: ImageDropZoneValue | null
  onSelect: (file: File) => void
  onClear: () => void
  accept?: string[]
  disabled?: boolean
  label?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const pick = useCallback(
    (files: FileList | File[] | null) => {
      if (disabled || !files) return
      const file = Array.from(files).find((f) => accept.includes(f.type))
      if (file) onSelect(file)
    },
    [accept, disabled, onSelect],
  )

  // Paste: listen while the zone (or anything inside it) has focus.
  useEffect(() => {
    const zone = zoneRef.current
    if (!zone) return
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return
      const files = event.clipboardData?.files
      if (files && files.length > 0) {
        event.preventDefault()
        pick(files)
      }
    }
    zone.addEventListener('paste', onPaste)
    return () => zone.removeEventListener('paste', onPaste)
  }, [disabled, pick])

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- object/signed URLs, not optimizable assets */}
        <img
          src={value.previewUrl}
          alt={value.name}
          className="h-16 w-16 shrink-0 rounded-xl border border-neutral-200 object-cover"
        />
        <p className="min-w-0 flex-1 truncate text-sm text-neutral-700">{value.name}</p>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          aria-label="Remove image"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div
      ref={zoneRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        pick(event.dataTransfer?.files ?? null)
      }}
      className={[
        'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
        dragging ? 'border-orange-400 bg-orange-50' : 'border-neutral-300 bg-neutral-50 hover:border-orange-300 hover:bg-orange-50/40',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p className="text-sm font-semibold text-neutral-700">{label}</p>
      <p className="text-xs text-neutral-400">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          pick(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
