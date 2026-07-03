'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { AccessLevel, PlatformSpace } from '@/lib/permissions'
import { getSideNavSections } from '@/lib/role-access'
import type { NavIcon, PlatformRole } from '@/lib/role-access'

// ─── Icon set ─────────────────────────────────────────────────────────────────
// One compact outline glyph per nav item, keyed by NavItem.icon. Kept inline so
// the sidebar has no icon-library dependency.
const ICON_PATHS: Record<NavIcon, string> = {
  dashboard: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  planner: 'M6.75 3v2.25M17.25 3v2.25M3.75 18.75V7.5a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v11.25m-16.5 0A2.25 2.25 0 006 21h12a2.25 2.25 0 002.25-2.25m-16.5 0V11.25a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25v7.5',
  campus: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  whatsapp: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  crm: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  initiatives: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  board: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  congress: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  conferences: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  podcast: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
  events: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
  network: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
  library: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
  resources: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  admin:    'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  feedback: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
}

export function NavGlyph({ icon }: { icon: NavIcon }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.6}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon]} />
    </svg>
  )
}

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
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
        aria-label="Main navigation"
      >
        {sections.map((section, index) => {
          const isCollapsed = collapsed.has(section.label)
          return (
            <div
              key={section.label}
              className={[
                'space-y-1 pb-2',
                index > 0 ? 'mt-3 border-t border-white/10 pt-4' : '',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-slate-200"
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
                  // The flagship Annual Congress uses its own accent (amber) so it
                  // stands apart from both the regular items and the orange CTAs.
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={[
                        'flex items-center justify-between gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? item.priority
                            ? 'bg-amber-400/15 text-amber-300'
                            : 'bg-[#343449] text-white'
                          : item.priority
                            ? 'text-amber-300/90 hover:bg-amber-400/10 hover:text-amber-200'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <NavGlyph icon={item.icon} />
                        <span className="truncate">{item.label}</span>
                      </span>
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
