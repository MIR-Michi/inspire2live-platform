'use client'

import { useRouter } from 'next/navigation'

export type NavSelectOption = {
  /** Value used for the <option> and to match the current selection. */
  value: string
  label: string
  /** Where to navigate when this option is chosen. */
  href: string
}

/**
 * A filter rendered as a dropdown that navigates on change. URL composition is
 * kept on the server (each option carries its own pre-built href), so this
 * client component only has to push the selected option's href. Used for the
 * Events and CRM list filters, replacing rows of pill buttons.
 */
export function NavSelect({
  label,
  value,
  options,
  className = '',
}: {
  label: string
  value: string
  options: NavSelectOption[]
  className?: string
}) {
  const router = useRouter()

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value)
          if (next) router.push(next.href)
        }}
        className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-800 shadow-sm focus:border-neutral-400 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
