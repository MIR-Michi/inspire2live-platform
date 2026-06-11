'use client'

import Link from 'next/link'

export function CommsDashboardToggle({ view }: { view: 'personal' | 'team' }) {
  const options: Array<{ key: 'personal' | 'team'; label: string }> = [
    { key: 'personal', label: 'My dashboard' },
    { key: 'team', label: 'Team dashboard' },
  ]

  return (
    <div
      className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Dashboard view"
    >
      {options.map((option) => {
        const active = view === option.key
        return (
          <Link
            key={option.key}
            href={`/app/comms/dashboard?view=${option.key}`}
            role="tab"
            aria-selected={active}
            className={[
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            ].join(' ')}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
