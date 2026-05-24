'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canAccessAppPath, getSideNavItems, getRoleLabel, ROLE_LABELS, type NavKey } from '@/lib/role-access'
import { RoleChips } from '@/components/roles/role-chips'
import type { UserType } from '@/lib/user-workspace'

/* ── icon helper (same set as side-nav, inlined for mobile menu) ────────── */
const iconClass = 'h-5 w-5 shrink-0'

function MobileNavIcon({ navKey }: { navKey: NavKey }) {
  switch (navKey) {
    case 'dashboard':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      )
    case 'initiatives':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      )
    case 'comms':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 3.94c.09-.54.56-.94 1.1-.94h1.12c.54 0 1.01.4 1.1.94l.18 1.06a7.502 7.502 0 013.12 1.81l.95-.5a1.125 1.125 0 011.37.23l.79.79c.4.4.49 1.01.23 1.5l-.5.95A7.5 7.5 0 0121 12c0 .8-.13 1.58-.37 2.3l.5.95c.26.49.17 1.1-.23 1.5l-.79.79c-.4.4-1.01.49-1.5.23l-.95-.5A7.502 7.502 0 0114 19.19l-.18 1.06c-.09.54-.56.94-1.1.94h-1.12c-.54 0-1.01-.4-1.1-.94l-.18-1.06a7.502 7.502 0 01-3.12-1.81l-.95.5a1.125 1.125 0 01-1.37-.23l-.79-.79a1.125 1.125 0 01-.23-1.5l.5-.95A7.5 7.5 0 013 12c0-.8.13-1.58.37-2.3l-.5-.95a1.125 1.125 0 01.23-1.5l.79-.79c.4-.4 1.01-.49 1.5-.23l.95.5A7.502 7.502 0 0110.16 5l.18-1.06z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h7.5M8.25 15h4.5M8.25 9h7.5" />
        </svg>
      )
    case 'bureau':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    case 'resources':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      )
  }
}

const ALL_PERSPECTIVE_ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label: value === 'PlatformAdmin' ? `${label} (default)` : label,
}))

const ALL_WORKSPACE_TYPES: Array<{ value: UserType; label: string }> = [
  { value: 'default', label: 'Platform (default)' },
  { value: 'comms', label: 'Communications' },
  { value: 'board', label: 'Board' },
  { value: 'partner', label: 'Partner' },
]

const COMMS_MOBILE_NAV = [
  { key: 'dashboard' as NavKey, label: 'Dashboard', href: '/app/dashboard' },
  { key: 'comms' as NavKey, label: 'Planner', href: '/app/comms/planner' },
  { key: 'comms' as NavKey, label: 'Campus', href: '/app/comms/campus' },
  { key: 'comms' as NavKey, label: 'Annual Congress', href: '/app/congress' },
  { key: 'comms' as NavKey, label: 'All events', href: '/app/comms/events' },
  { key: 'resources' as NavKey, label: 'Library', href: '/app/comms/library' },
]

interface TopNavProps {
  userName: string
  userRole: string
  userInitials: string
  unreadCount?: number
  isAdmin?: boolean
  viewAsRole?: string | null
  viewAsUserType?: UserType | null
  showCommsNav?: boolean
  workspaceLabel?: string
}

export function TopNav({
  userName,
  userRole,
  userInitials,
  unreadCount = 0,
  isAdmin = false,
  viewAsRole,
  viewAsUserType,
  showCommsNav = false,
  workspaceLabel = 'Platform',
}: TopNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  /* close mobile menu on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* trap focus inside mobile menu */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }


  const notificationsAccessible = canAccessAppPath(userRole, '/app/notifications')
  const navItems = showCommsNav ? COMMS_MOBILE_NAV : getSideNavItems(userRole, { showComms: showCommsNav })
  const previewActive = Boolean(
    (viewAsRole && viewAsRole !== 'PlatformAdmin') ||
    (viewAsUserType && viewAsUserType !== 'default')
  )

  const resetPreview = () => {
    document.cookie = 'i2l-view-as-role=; path=/; max-age=0'
    document.cookie = 'i2l-view-as-user-type=; path=/; max-age=0'
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-neutral-200 bg-white px-3 shadow-sm md:h-16 md:px-4"
        role="banner"
      >
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger — visible below lg */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>

          <Link href="/app/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-600 text-xs font-bold text-white">
              I2L
            </span>
            <span className="hidden text-sm font-semibold text-neutral-900 sm:block">
              {showCommsNav ? 'Comms' : 'Inspire2Live Platform'}
            </span>
          </Link>
        </div>

        {/* Center: perspective switcher (admin only, all screens) */}
        {isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 sm:px-3">
            <svg className="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden text-xs font-semibold text-orange-700 xl:inline">Preview:</span>
            <span className="hidden text-xs font-semibold text-orange-700 sm:inline">Role</span>
            <select
              value={viewAsRole ?? 'PlatformAdmin'}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'PlatformAdmin') {
                  document.cookie = 'i2l-view-as-role=; path=/; max-age=0'
                } else {
                  document.cookie = `i2l-view-as-role=${val}; path=/; max-age=86400; SameSite=Lax`
                }
                router.push('/app/dashboard')
                router.refresh()
              }}
              className="max-w-36 rounded-md border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-800 outline-none ring-orange-300 focus:ring-2 cursor-pointer"
              aria-label="Switch platform role preview"
            >
              {ALL_PERSPECTIVE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <span className="hidden text-xs font-semibold text-orange-700 sm:inline">Workspace</span>
            <select
              value={viewAsUserType ?? 'default'}
              onChange={(e) => {
                const val = e.target.value as UserType
                if (val === 'default') {
                  document.cookie = 'i2l-view-as-user-type=; path=/; max-age=0'
                } else {
                  document.cookie = `i2l-view-as-user-type=${val}; path=/; max-age=86400; SameSite=Lax`
                }
                router.push('/app/dashboard')
                router.refresh()
              }}
              className="max-w-44 rounded-md border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-800 outline-none ring-orange-300 focus:ring-2 cursor-pointer"
              aria-label="Switch workspace user type preview"
            >
              {ALL_WORKSPACE_TYPES.map((workspace) => (
                <option key={workspace.value} value={workspace.value}>
                  {workspace.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Right: notifications + profile */}
        <div className="flex items-center gap-2">
          <RoleChips compact workspaceLabel={workspaceLabel} />

          {notificationsAccessible ? (
            <Link
              href="/app/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ) : null}

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              aria-label="Account menu"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {userInitials}
              </span>
              <span className="hidden max-w-30 truncate sm:block">{userName}</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-1 w-52 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" role="menu">
                <div className="border-b border-neutral-100 px-3 py-2">
                  <p className="text-xs font-medium text-neutral-900 truncate">{userName}</p>
                  <p className="text-xs text-neutral-500">{getRoleLabel(userRole)} · {workspaceLabel}</p>
                </div>

                <Link
                  href="/app/profile"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile &amp; settings
                </Link>
                {isAdmin && previewActive && (
                  <button
                    onClick={() => {
                      resetPreview()
                      setProfileOpen(false)
                      router.push('/app/dashboard')
                      router.refresh()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                    role="menuitem"
                  >
                    Reset to Admin view
                  </button>
                )}
                <Link
                  href="/login"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  Switch demo account
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile slide-out navigation overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <nav
            id="mobile-nav"
            ref={mobileMenuRef}
            className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Drawer header */}
            <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4 md:h-16">
              <span className="text-sm font-semibold text-neutral-900">Navigation</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label="Close navigation"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Nav items */}
            <div className="flex flex-col gap-1 p-3">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={[
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    ].join(' ')}
                    aria-current={active ? 'page' : undefined}
                  >
                    {!showCommsNav && <MobileNavIcon navKey={item.key} />}
                    {item.label}
                  </Link>
                )
              })}
            </div>
            {/* Drawer footer: user info */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-200 p-4">
              <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
              <p className="text-xs text-neutral-500">{getRoleLabel(userRole)} · {workspaceLabel}</p>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
