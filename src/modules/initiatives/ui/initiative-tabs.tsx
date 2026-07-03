'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = {
  label: string
  href: string
}

export function InitiativeTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  return (
    <nav className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
      <ul className="flex min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  'inline-flex rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-orange-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
