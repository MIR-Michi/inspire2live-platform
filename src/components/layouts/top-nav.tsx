'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canAccessAppPath, getSideNavSections, getRoleLabel } from '@/lib/role-access'
import type { AccessLevel, PlatformSpace } from '@/lib/permissions'
import { PreviewPanel } from '@/components/layouts/preview-panel'
import { useRoleLayers } from '@/components/roles/role-layers-context'

interface TopNavProps {
  userName: string
  userRole: string
  userInitials: string
  unreadCount?: number
  isAdmin?: boolean
  viewAsRole?: string | null
  /** Effective access levels per space (server-resolved, includes DB overrides). */
  effectiveSpaces: Record<PlatformSpace, AccessLevel>
}

export function TopNav({
  userName,
  userRole,
  userInitials,
  unreadCount = 0,
  isAdmin = false,
  viewAsRole,
  effectiveSpaces,
}: TopNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { congressRoles } = useRoleLayers()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const congressLabel = congressRoles.length > 0 ? congressRoles.join(', ') : null

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
  const spaces: Record<PlatformSpace, AccessLevel> = isAdmin
    ? { ...effectiveSpaces, admin: 'manage' }
    : effectiveSpaces
  const navSections = getSideNavSections(userRole, spaces)

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
            <Image
              src="/brand/inspire2live-logo.png"
              alt="Inspire2Live"
              width={409}
              height={262}
              priority
              className="h-9 w-auto md:h-10"
            />
          </Link>
        </div>

        {/* Right: preview (admin) + notifications + profile */}
        <div className="flex items-center gap-2">
          {isAdmin && <PreviewPanel viewAsRole={viewAsRole} />}

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
                  <p className="text-xs text-neutral-500">{getRoleLabel(userRole)}</p>
                  {congressLabel && (
                    <p className="mt-0.5 text-[11px] text-neutral-400 truncate">Congress: {congressLabel}</p>
                  )}
                </div>

                <Link
                  href="/app/profile"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile &amp; settings
                </Link>
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
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#202133] text-slate-200 shadow-xl"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Drawer header */}
            <div className="flex h-14 items-center justify-between border-b border-white/5 px-4 md:h-16">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {getRoleLabel(userRole)}
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close navigation"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Nav sections */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
              {navSections.map((section) => (
                <div key={section.label} className="space-y-1.5">
                  <p className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={[
                          'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>
            {/* Drawer footer: user info */}
            <div className="border-t border-white/5 p-4">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-slate-400">{getRoleLabel(userRole)}</p>
              {congressLabel && (
                <p className="mt-0.5 truncate text-[11px] text-slate-500">Congress: {congressLabel}</p>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
