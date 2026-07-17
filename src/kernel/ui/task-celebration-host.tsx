'use client'

import { useEffect, useRef, useState } from 'react'
import {
  TaskCompletionCelebration,
  type CelebrationOrigin,
} from '@/kernel/ui/task-completion-celebration'

const EVENT_NAME = 'i2l:task-completed'
const COOLDOWN_MS = 500

export function announceTaskCompletion(element?: HTMLElement | null) {
  const rect = element?.getBoundingClientRect()
  const origin = rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { origin } }))
}

export function TaskCelebrationHost() {
  const [active, setActive] = useState(false)
  const [origin, setOrigin] = useState<CelebrationOrigin | null>(null)
  const [announcementKey, setAnnouncementKey] = useState(0)
  const lastAt = useRef(0)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const onCompleted = (event: Event) => {
      const now = Date.now()
      setAnnouncementKey((key) => key + 1)

      // Rapid completions still receive the live-region acknowledgement, but
      // avoid continuously covering the interface with particles.
      if (now - lastAt.current < COOLDOWN_MS) return
      lastAt.current = now
      const detail = (event as CustomEvent<{ origin?: CelebrationOrigin | null }>).detail
      setOrigin(detail?.origin ?? null)
      setActive(false)
      window.requestAnimationFrame(() => setActive(true))
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setActive(false), 950)
    }
    window.addEventListener(EVENT_NAME, onCompleted)
    return () => {
      window.removeEventListener(EVENT_NAME, onCompleted)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  return (
    <>
      {announcementKey > 0 && (
        <span key={announcementKey} className="sr-only" role="status" aria-live="polite">Task completed.</span>
      )}
      <TaskCompletionCelebration active={active} origin={origin} />
    </>
  )
}
