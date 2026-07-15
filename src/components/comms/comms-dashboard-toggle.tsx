'use client'

import Link from 'next/link'

export function CommsDashboardToggle({ view, showAdmin = false }: { view: 'personal' | 'team'; showAdmin?: boolean }) {
  // For admins, offer a jump back to the admin dashboard alongside the
  // personal/team comms views.
  const options: Array<{ key: string; label: string; href: string; active: boolean }> = [
    ...(showAdmin ? [{ key: 'admin', label: 'Admin', href: '/app/dashboard', active: false }] : []),
    { key: 'personal', label: 'My dashboard', href: '/app/comms/dashboard?view=personal', active: view === 'personal' },
    { key: 'team', label: 'Team dashboard', href: '/app/comms/dashboard?view=team', active: view === 'team' },
  ]

  return (
    <div
      className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Dashboard view"
    >
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          role="tab"
          aria-selected={option.active}
          className={[
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            option.active
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
          ].join(' ')}
        >
          {option.label}
        </Link>
      ))}
    </div>
  )
}
