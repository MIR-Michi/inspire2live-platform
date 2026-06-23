'use client'

import { useState } from 'react'

export function OptionalField({
  label,
  hasValue,
  children,
}: {
  label: string
  hasValue: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(hasValue)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-neutral-400 transition hover:text-neutral-700"
      >
        + {label}
      </button>
    )
  }

  return <>{children}</>
}
