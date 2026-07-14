'use client'

/**
 * settings-shell.tsx
 *
 * The Platform Settings space chrome (ADR-0010): a left section sub-nav plus the
 * active page. Wraps both the new `/app/settings/*` pages and the migrated
 * `/app/admin/*` pages so every configuration surface renders as one section of
 * one settings space — replacing the old "User Management is the hub" pattern.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SETTINGS_SECTIONS } from '@/kernel/shell/settings-nav'
import { NavGlyph } from '@/components/layouts/side-nav'

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
      <nav
        aria-label="Platform settings sections"
        className="shrink-0 lg:w-60"
      >
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Platform</p>
          <h2 className="text-lg font-bold text-neutral-900">Settings</h2>
        </div>
        <div className="space-y-4">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = !item.planned && isActive(item.href)
                  if (item.planned) {
                    return (
                      <li key={item.id}>
                        <span
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-neutral-300"
                          title="Planned — not yet available"
                        >
                          <NavGlyph icon={item.icon} />
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-300">soon</span>
                        </span>
                      </li>
                    )
                  }
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                        ].join(' ')}
                      >
                        <NavGlyph icon={item.icon} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
