'use client'

import Link from 'next/link'

/**
 * Toggle on the admin dashboard that lets an admin jump to the Communications
 * team dashboard and back — admins have full comms access, so they can work the
 * team board without switching perspective (view-as).
 */
export function AdminDashboardToggle({ active }: { active: 'admin' | 'comms' }) {
  const options: Array<{ key: 'admin' | 'comms'; label: string; href: string }> = [
    { key: 'admin', label: 'Admin dashboard', href: '/app/dashboard' },
    { key: 'comms', label: 'Comms team', href: '/app/comms/dashboard?view=team' },
  ]

  return (
    <div
      className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="Admin dashboard view"
    >
      {options.map((option) => {
        const isActive = active === option.key
        return (
          <Link
            key={option.key}
            href={option.href}
            role="tab"
            aria-selected={isActive}
            className={[
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              isActive
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
