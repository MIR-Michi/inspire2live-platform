'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import type { AccessLevel, PlatformSpace } from '@/lib/permissions'
import { NAV_SECTIONS_BY_ROLE } from '@/lib/role-access'
import type { PlatformRole } from '@/lib/role-access'

// ─── Component ────────────────────────────────────────────────────────────────
//
// A single, unified dark sidebar for every role. The grouped/sectioned layout —
// originally the Communications workspace blueprint — is now the standard. The
// section/item definitions live in `role-access.ts` (NAV_SECTIONS_BY_ROLE); this
// component only renders them and applies access-level filtering using the
// server-resolved `effectiveSpaces` (which includes DB overrides).

interface SideNavProps {
  /** The effective (view-as aware) platform role driving the section layout. */
  role: PlatformRole
  /**
   * Effective access levels per space, resolved in the Server Component layout.
   * Includes DB overrides. Passed as a serialisable plain object.
   */
  effectiveSpaces: Record<PlatformSpace, AccessLevel>
  /**
   * True if the actual (un-impersonated) user is a PlatformAdmin.
   * When true the admin nav item is always shown, even during view-as mode.
   */
  isAdmin: boolean
  /** Live count for the Campus badge (Comms workspace only). */
  commsUnreadCount?: number
  /** Header label shown above the nav (e.g. the role / workspace name). */
  workspaceLabel?: string
}

export function SideNav({
  role,
  effectiveSpaces,
  isAdmin,
  commsUnreadCount = 0,
  workspaceLabel = 'Platform',
}: SideNavProps) {
  const pathname = usePathname()

  // Merge: admin always visible for PlatformAdmin users (even in view-as mode).
  const spaces: Record<PlatformSpace, AccessLevel> = isAdmin
    ? { ...effectiveSpaces, admin: 'manage' }
    : effectiveSpaces

  // Filter each section's items by effective access; drop empty sections.
  const sections = NAV_SECTIONS_BY_ROLE[role]
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) =>
        canAccess(spaces[item.key as PlatformSpace], 'view'),
      ),
    }))
    .filter((section) => section.items.length > 0)

  const isComms = role === 'Comms'

  return (
    <aside
      className="hidden w-60 shrink-0 bg-[#202133] text-slate-200 lg:flex lg:flex-col"
      role="complementary"
      aria-label="Sidebar navigation"
    >
      <div className="px-4 pb-3 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {workspaceLabel}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-5 px-3 py-2" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1.5">
            <p className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {section.label}
            </p>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              const badgeCount = item.badge === 'campus' ? commsUnreadCount : 0
              return (
                <Link
                  key={item.href}
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
        ))}
      </nav>
      {isComms && (
        <div className="border-t border-white/5 p-4 text-xs leading-5 text-slate-500">
          Other sections via profile menu
        </div>
      )}
    </aside>
  )
}
