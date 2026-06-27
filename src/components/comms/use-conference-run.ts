'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConferenceStatus, startConferenceRun } from '@/app/app/comms/conferences/run-actions'
import type { ConferenceRunStatus, ConferenceRunState } from '@/lib/ai/conference-run'

const POLL_MS = 4000

/**
 * Drives conference discovery from the client. It supports both deterministic
 * action completion and polling when another run is already in progress.
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

  useEffect(() => {
    if (initial?.status === 'running') poll()
    return stopPoll
  }, [initial?.status, poll, stopPoll])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])

  const start = useCallback(async () => {
    setStarting(true)
    setStatus('running')
    setMessage(null)
    setElapsed(0)
    try {
      const result = await startConferenceRun()
      if (!result.ok) {
        setStatus('error')
        setMessage(result.message ?? 'Could not start the discovery run.')
        return
      }
      setStatus(result.status)
      setMessage(result.message ?? null)
      if (result.status === 'running') poll()
      else router.refresh()
    } finally {
      setStarting(false)
    }
  }, [poll, router])

  return { status, running, starting, busy, elapsed, message, start }
}
