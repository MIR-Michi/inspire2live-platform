'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConferenceStatus, startConferenceRun } from '@/app/app/comms/conferences/run-actions'
import type { ConferenceRunStatus, ConferenceRunState } from '@/lib/ai/conference-run'

const POLL_MS = 4000

/**
 * Drives the background conference-discovery run from a client component: kicks
 * it off, polls the singleton status until it finishes, then refreshes the
 * server data so new conferences appear. Resumes polling on mount if a run is
 * already in progress.
 */
export function useConferenceRun(initial: ConferenceRunStatus | null) {
  const router = useRouter()
  const [status, setStatus] = useState<ConferenceRunState>(initial?.status ?? 'idle')
  const [message, setMessage] = useState<string | null>(initial?.status === 'running' ? null : initial?.message ?? null)
  const [starting, setStarting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const running = status === 'running'
  const busy = starting || running

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const poll = useCallback(() => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      const next = await getConferenceStatus()
      if (!next || next.status === 'running') return
      stopPoll()
      setStatus(next.status)
      setMessage(next.message)
      router.refresh()
    }, POLL_MS)
  }, [router, stopPoll])

  // Resume polling if a run was already in progress when the page loaded.
  useEffect(() => {
    if (initial?.status === 'running') poll()
    return stopPoll
  }, [initial?.status, poll, stopPoll])

  // Elapsed timer while a run is active.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  const start = useCallback(async () => {
    setStarting(true)
    setMessage(null)
    setElapsed(0)
    try {
      const result = await startConferenceRun()
      if (!result.ok) {
        setStatus('error')
        setMessage(result.message ?? 'Could not start the discovery run.')
        return
      }
      setStatus('running')
      poll()
    } finally {
      setStarting(false)
    }
  }, [poll])

  return { status, running, starting, busy, elapsed, message, start }
}
