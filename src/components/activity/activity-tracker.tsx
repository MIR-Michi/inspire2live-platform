'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { spaceFromPath, HEARTBEAT_SECONDS, type ActivityKind } from '@/lib/activity-spaces'

// Only count a heartbeat as "active" if the user interacted within this window.
const ACTIVE_WINDOW_MS = 60_000

// Module-level so it's never a render-scope closure (keeps it out of the React
// purity rules and avoids stale captures — the path is passed in explicitly).
function postActivity(kind: ActivityKind, path: string) {
  try {
    void fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, space: spaceFromPath(path), path }),
      keepalive: true,
    })
  } catch {
    // ignore — telemetry is best-effort
  }
}

/**
 * Invisible client tracker mounted in the authenticated app shell. It records:
 *   • a pageview on every route change (where the user goes), and
 *   • a heartbeat every ~20s, but ONLY while the tab is visible and the user has
 *     interacted recently — so idle "just logged in" time doesn't inflate the
 *     engagement metrics.
 * The server derives the user from the session; we only send kind/space/path.
 */
export function ActivityTracker() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const lastActivity = useRef<number>(0)

  // Track recent interaction so heartbeats only fire for engaged users.
  useEffect(() => {
    lastActivity.current = Date.now()
    const mark = () => {
      lastActivity.current = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'mousemove', 'touchstart']
    for (const evt of events) window.addEventListener(evt, mark, { passive: true })
    const onVisibility = () => {
      if (document.visibilityState === 'visible') lastActivity.current = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      for (const evt of events) window.removeEventListener(evt, mark)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Pageview on each route change; keep the ref in sync for the heartbeat timer.
  useEffect(() => {
    pathRef.current = pathname
    lastActivity.current = Date.now()
    postActivity('pageview', pathname || '/')
  }, [pathname])

  // Heartbeat while visible + recently active.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastActivity.current > ACTIVE_WINDOW_MS) return
      postActivity('heartbeat', pathRef.current || '/')
    }, HEARTBEAT_SECONDS * 1000)
    return () => window.clearInterval(id)
  }, [])

  return null
}
