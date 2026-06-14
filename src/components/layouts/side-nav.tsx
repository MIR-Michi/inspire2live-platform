'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { AccessLevel, PlatformSpace } from '@/lib/permissions'
import { getSideNavSections } from '@/lib/role-access'
import type { PlatformRole } from '@/lib/role-access'

// ─── Component ────────────────────────────────────────────────────────────────
//
// A single, unified dark sidebar for every role. The grouped/sectioned layout —
// originally the Communications workspace blueprint — is the standard. The
// Communications role keeps its curated blueprint; every other role sees a
// permission-filtered view of the master tree, derived from the server-resolved
// `effectiveSpaces` (which includes DB overrides). See `getSideNavSections`.
//
// Spaces (sections) can be collapsed/expanded individually, and the nav itself
// scrolls when it is taller than the viewport so every item stays reachable.

interface SideNavProps {
  /** The effective (view-as aware) platform role — selects the comms blueprint vs the master tree. */
  role: PlatformRole
  /**
   * Effective access levels per space, resolved in the Server Component layout.
   * Includes DB overrides. Passed as a serialisable plain object.
   */
  effectiveSpaces: Record<PlatformSpace, AccessLevel>
  /**
   * True if the actual (un-impersonated) user is a PlatformAdmin.
   * When true the admin items are always shown, even during view-as mode.
   */
  isAdmin: boolean
  /** Live count for the Campus badge. */
  commsUnreadCount?: number
  /** Header label shown above the nav (e.g. the role / workspace name). */
  workspaceLabel?: string
}

const COLLAPSED_STORAGE_KEY = 'i2l:navCollapsedSections'

export function SideNav({
  role,
  effectiveSpaces,
  isAdmin,
  commsUnreadCount = 0,
  workspaceLabel = 'Platform',
}: SideNavProps) {
  const pathname = usePathname()

  // Admin always sees admin items for PlatformAdmin users (even in view-as mode).
  const spaces: Record<PlatformSpace, AccessLevel> = isAdmin
    ? { ...effectiveSpaces, admin: 'manage' }
    : effectiveSpaces

  const sections = getSideNavSections(role, spaces)

  // Track which sections are collapsed, persisted per browser.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY)
      // Read persisted preference after mount to avoid an SSR/hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]))
    } catch {
      // Ignore malformed/unavailable storage — start fully expanded.
    }
  }, [])

  const toggleSection = (label: string) => {
    setCollapsed((prev) => {
      const nextSet = new Set(prev)
      if (nextSet.has(label)) {
        nextSet.delete(label)
      } else {
        nextSet.add(label)
      }
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...nextSet]))
      } catch {
        // Persistence is best-effort.
      }
      return nextSet
    })
  }

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col bg-[#202133] text-slate-200 lg:flex"
      role="complementary"
      aria-label="Sidebar navigation"
    >
      <div className="shrink-0 px-4 pb-3 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {workspaceLabel}
        </p>
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-2"
        aria-label="Main navigation"
      >
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.label)
          return (
            <div key={section.label} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-300"
              >
                <span>{section.label}</span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!isCollapsed &&
                section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  const badgeCount = item.badge === 'campus' ? commsUnreadCount : 0
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={[
                        'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? item.priority
                            ? 'bg-[#343449] text-orange-300'
                            : 'bg-[#343449] text-white'
                          : item.priority
                            ? 'text-orange-300 hover:bg-white/5'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span>{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
