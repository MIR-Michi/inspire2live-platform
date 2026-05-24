'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAccess } from '@/lib/permissions'
import type { AccessLevel, PlatformSpace } from '@/lib/permissions'

// ─── Nav item definitions ─────────────────────────────────────────────────────
//
// This is the single source of truth for nav items.
// Visibility is controlled by effectiveSpaces (which includes DB overrides).

const ALL_NAV_ITEMS: { key: PlatformSpace; label: string; href: string }[] = [
  { key: 'dashboard',   label: 'Dashboard',       href: '/app/dashboard' },
  { key: 'comms',       label: 'Communications',  href: '/app/comms' },
  { key: 'initiatives', label: 'Initiatives',      href: '/app/initiatives' },
  { key: 'tasks',       label: 'My Tasks',         href: '/app/tasks' },
  { key: 'bureau',      label: 'Bureau',           href: '/app/bureau' },
  { key: 'congress',    label: 'Congress',         href: '/app/congress' },
  { key: 'stories',     label: 'Patient Stories',  href: '/app/stories' },
  { key: 'resources',   label: 'Resources',        href: '/app/resources' },
  { key: 'partners',    label: 'Partners',         href: '/app/partners' },
  { key: 'network',     label: 'Network',          href: '/app/network' },
  { key: 'board',       label: 'Board',            href: '/app/board' },
  { key: 'profile',     label: 'My Profile',       href: '/app/profile' },
  { key: 'admin',       label: 'User Management',  href: '/app/admin/users' },
]

const COMMS_NAV_SECTIONS: Array<{
  label: string
  items: Array<{ label: string; href: string; badge?: 'campus'; priority?: boolean }>
}> = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/app/dashboard' }],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Planner', href: '/app/comms/planner' },
      { label: 'Campus', href: '/app/comms/campus', badge: 'campus' },
    ],
  },
  {
    label: 'Events',
    items: [
      { label: 'Annual Congress', href: '/app/congress', priority: true },
      { label: 'All events', href: '/app/comms/events' },
    ],
  },
  {
    label: 'Content',
    items: [{ label: 'Library', href: '/app/comms/library' }],
  },
]

const iconClass = 'h-4 w-4 shrink-0'

// ─── Icons ────────────────────────────────────────────────────────────────────

const DashIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
)
const InitIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
  </svg>
)
const TaskIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const BureauIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const ResourceIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
)
const PartnerIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
)
const CongressIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
)
const BoardViewIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
  </svg>
)
const ProfileIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)
const StoriesIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h9A2.25 2.25 0 0118.75 6.75v10.5A2.25 2.25 0 0116.5 19.5h-9A2.25 2.25 0 015.25 17.25V6.75A2.25 2.25 0 017.5 4.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 8h7M8.5 11h7M8.5 14h4" />
  </svg>
)
const AdminIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)
const NetworkIcon = () => (
  <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
)

function iconForKey(key: PlatformSpace) {
  switch (key) {
    case 'dashboard':   return <DashIcon />
    case 'comms':       return <StoriesIcon />
    case 'initiatives': return <InitIcon />
    case 'tasks':       return <TaskIcon />
    case 'bureau':      return <BureauIcon />
    case 'congress':    return <CongressIcon />
    case 'stories':     return <StoriesIcon />
    case 'resources':   return <ResourceIcon />
    case 'partners':    return <PartnerIcon />
    case 'network':     return <NetworkIcon />
    case 'board':       return <BoardViewIcon />
    case 'profile':     return <ProfileIcon />
    case 'admin':       return <AdminIcon />
    default:            return <DashIcon />
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SideNavProps {
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
  showCommsWorkspace?: boolean
  commsUnreadCount?: number
  workspaceLabel?: string
}

export function SideNav({
  effectiveSpaces,
  isAdmin,
  showCommsWorkspace = false,
  commsUnreadCount = 0,
  workspaceLabel = 'Platform',
}: SideNavProps) {
  const pathname = usePathname()

  if (showCommsWorkspace) {
    return (
      <aside
        className="hidden w-60 shrink-0 bg-[#202133] text-slate-200 lg:flex lg:flex-col"
        role="complementary"
        aria-label="Communications navigation"
      >
        <div className="px-4 pb-3 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{workspaceLabel}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-5 px-3 py-2" aria-label="Communications workspace navigation">
          {COMMS_NAV_SECTIONS.map((section) => (
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
        <div className="border-t border-white/5 p-4 text-xs leading-5 text-slate-500">
          Other sections via profile menu
        </div>
      </aside>
    )
  }

  // Merge: admin always visible for PlatformAdmin users (even in view-as mode)
  const spaces: Record<PlatformSpace, AccessLevel> = isAdmin
    ? { ...effectiveSpaces, admin: 'manage' }
    : effectiveSpaces

  // Filter: show only spaces the user can at least view
  const items = ALL_NAV_ITEMS.filter((item) => canAccess(spaces[item.key], 'view'))

  return (
    <aside
      className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white lg:flex lg:flex-col"
      role="complementary"
      aria-label="Sidebar navigation"
    >
      <nav className="flex flex-col gap-0.5 p-3 pt-4" aria-label="Main navigation">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-orange-50 text-orange-700 border-l-2 border-orange-600'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              ].join(' ')}
            >
              {iconForKey(item.key)}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
