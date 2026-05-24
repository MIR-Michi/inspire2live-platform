import { describe, it, expect } from 'vitest'
import { canAccessCommsWorkspace, getPostLoginLandingPath } from '@/lib/comms-access'

/**
 * Unit tests for middleware routing logic.
 *
 * The middleware itself relies on Supabase + Next.js internals which are
 * hard to run in jsdom. Instead we test the *pure routing decision logic*
 * extracted from middleware.ts as a plain function so we can reason about
 * all cases without mocking heavy I/O.
 *
 * This mirrors what middleware.ts does:
 *  - !user && /app/* → redirect /login
 *  - user && /login  → redirect /app/dashboard
 *  - user && !onboardingCompleted && /app/* → redirect /onboarding
 *  - everything else → pass through (null = no redirect)
 */

type RoutingInput = {
  user: boolean
  onboardingCompleted: boolean | null
  role?: string | null
  commsTeam?: boolean | null
  userType?: string | null
  pathname: string
}

function resolveRedirect(input: RoutingInput): string | null {
  const { user, onboardingCompleted, pathname, role = null, commsTeam = null, userType = null } = input

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isOnboardingPage = pathname.startsWith('/onboarding')
  const isProtected = pathname.startsWith('/app')

  if (!user && isProtected) return '/login'
  if (user && isAuthPage) return getPostLoginLandingPath(role, commsTeam, userType)
  if (user && !isOnboardingPage && !isAuthPage && onboardingCompleted === false && isProtected) {
    return '/onboarding'
  }
  if (user && onboardingCompleted && pathname.startsWith('/app/comms')) {
    return canAccessCommsWorkspace(role, commsTeam, userType) ? null : '/app/dashboard'
  }
  return null
}

describe('Middleware routing logic', () => {
  describe('Unauthenticated user', () => {
    it('redirects to /login when accessing a protected /app route', () => {
      expect(
        resolveRedirect({ user: false, onboardingCompleted: null, pathname: '/app/dashboard' })
      ).toBe('/login')
    })

    it('redirects to /login when accessing any nested /app route', () => {
      expect(
        resolveRedirect({ user: false, onboardingCompleted: null, pathname: '/app/initiatives/123' })
      ).toBe('/login')
    })

    it('allows access to /login without redirect', () => {
      expect(
        resolveRedirect({ user: false, onboardingCompleted: null, pathname: '/login' })
      ).toBeNull()
    })

    it('allows access to the landing page without redirect', () => {
      expect(
        resolveRedirect({ user: false, onboardingCompleted: null, pathname: '/' })
      ).toBeNull()
    })
  })

  describe('Authenticated user — onboarding complete', () => {
    it('redirects away from /login to /app/dashboard', () => {
      expect(
        resolveRedirect({ user: true, onboardingCompleted: true, pathname: '/login' })
      ).toBe('/app/dashboard')
    })

    it('redirects comms-team users away from /login to the shared dashboard', () => {
      expect(
        resolveRedirect({
          user: true,
          onboardingCompleted: true,
          role: 'Moderator',
          commsTeam: true,
          pathname: '/login',
        })
      ).toBe('/app/dashboard')
    })

    it('passes through to /app/dashboard without redirect', () => {
      expect(
        resolveRedirect({ user: true, onboardingCompleted: true, pathname: '/app/dashboard' })
      ).toBeNull()
    })

    it('passes through to a nested /app route', () => {
      expect(
        resolveRedirect({ user: true, onboardingCompleted: true, pathname: '/app/initiatives' })
      ).toBeNull()
    })
  })

  describe('Authenticated user — onboarding NOT complete', () => {
    it('redirects to /onboarding when accessing /app route', () => {
      expect(
        resolveRedirect({ user: true, onboardingCompleted: false, pathname: '/app/dashboard' })
      ).toBe('/onboarding')
    })

    it('allows access to /onboarding itself without redirect loop', () => {
      expect(
        resolveRedirect({ user: true, onboardingCompleted: false, pathname: '/onboarding' })
      ).toBeNull()
    })

    it('does not redirect when user is on /login (already redirected to dashboard by auth check)', () => {
      // User is authenticated → /login check fires first → to /app/dashboard
      expect(
        resolveRedirect({ user: true, onboardingCompleted: false, pathname: '/login' })
      ).toBe('/app/dashboard')
    })

    it('blocks non-comms users from /app/comms routes', () => {
      expect(
        resolveRedirect({
          user: true,
          onboardingCompleted: true,
          role: 'Moderator',
          commsTeam: false,
          pathname: '/app/comms/intake',
        })
      ).toBe('/app/dashboard')
    })

    it('allows comms-team moderators to access /app/comms routes', () => {
      expect(
        resolveRedirect({
          user: true,
          onboardingCompleted: true,
          role: 'Moderator',
          commsTeam: true,
          pathname: '/app/comms/intake',
        })
      ).toBeNull()
    })

    it('allows user_type comms users to access /app/comms routes without role promotion', () => {
      expect(
        resolveRedirect({
          user: true,
          onboardingCompleted: true,
          role: 'PatientAdvocate',
          commsTeam: false,
          userType: 'comms',
          pathname: '/app/comms/planner',
        })
      ).toBeNull()
    })
  })
})
