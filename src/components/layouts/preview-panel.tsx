'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/role-access'
import { useRoleLayers } from '@/components/roles/role-layers-context'

const ALL_PERSPECTIVE_ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label: value === 'PlatformAdmin' ? `${label} (default)` : label,
}))

/**
 * Admin-only "Preview" control: a single eye button that opens a popover with
 * the role-as picker, the current role layers, and an exit action. Collapsed
 * by default; when a preview is active the button turns amber and shows the
 * previewed role, replacing the old full-width banner + inline selector.
 */
export function PreviewPanel({ viewAsRole }: { viewAsRole?: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { platformRole, congressRoles } = useRoleLayers()

  const previewing = Boolean(viewAsRole && viewAsRole !== 'PlatformAdmin')

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const applyRole = (val: string) => {
    if (val === 'PlatformAdmin') {
      document.cookie = 'i2l-view-as-role=; path=/; max-age=0'
    } else {
      document.cookie = `i2l-view-as-role=${val}; path=/; max-age=86400; SameSite=Lax`
    }
    router.push('/app/dashboard')
    router.refresh()
  }

  const congressLabel = !congressRoles || congressRoles.length === 0 ? '—' : congressRoles.join(', ')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors',
          previewing
            ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200'
            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100',
        ].join(' ')}
        aria-label="Admin preview"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="hidden sm:inline">
          {previewing ? `Previewing: ${ROLE_LABELS[viewAsRole as keyof typeof ROLE_LABELS] ?? viewAsRole}` : 'Preview'}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
          role="menu"
        >
          <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Preview as role
          </label>
          <select
            value={viewAsRole ?? 'PlatformAdmin'}
            onChange={(e) => applyRole(e.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm font-medium text-neutral-800 outline-none focus:ring-2 focus:ring-orange-300"
            aria-label="Switch platform role preview"
          >
            {ALL_PERSPECTIVE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
            <p>
              Platform role: <span className="font-semibold text-neutral-900">{platformRole}</span>
            </p>
            <p>
              Congress role(s): <span className="font-semibold text-neutral-900">{congressLabel}</span>
            </p>
          </div>

          {previewing && (
            <button
              onClick={() => applyRole('PlatformAdmin')}
              className="mt-3 w-full rounded-md bg-amber-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Exit preview
            </button>
          )}
        </div>
      )}
    </div>
  )
}
