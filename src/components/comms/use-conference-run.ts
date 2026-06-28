'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConferenceStatus } from '@/app/app/comms/conferences/run-actions'
import type { ConferenceRunStatus, ConferenceRunState } from '@/lib/ai/conference-run'

const POLL_MS = 4000
const LONG_WAIT_SECONDS = 300

function progressMessage(elapsed: number, providerMessage: string | null): string | null {
  if (providerMessage) return providerMessage
  if (elapsed < 5) return 'Starting background cache refresh and checking AI configuration.'
  if (elapsed < 35) return 'Preparing 24 global search lanes across regions and oncology focus areas.'
  if (elapsed < 120) return 'Searching Europe, North America, Latin America, Africa / Middle East, Asia-Pacific, and global conference sources.'
  if (elapsed < 220) return 'Collecting tumor-specific, research, clinical, patient advocacy, survivorship, nursing, and supportive-care meetings.'
  if (elapsed < LONG_WAIT_SECONDS) return 'Validating future dates, official URLs, and duplicate conference names before saving the cache.'
  return 'This cache refresh is taking longer than expected. The backend will stop the run and show a real error if no result arrives.'
}

export function useConferenceRun(initial: ConferenceRunStatus | null) {
  const router = useRouter()
  const [status, setStatus] = useState<ConferenceRunState>(initial?.status ?? 'idle')
  const [message, setMessage] = useState<string | null>(initial?.status === 'running' ? initial.message : initial?.message ?? null)
  const [starting, setStarting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const running = status === 'running'
  const busy = starting || running
  const progress = useMemo(() => progressMessage(elapsed, message), [elapsed, message])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollOnce = useCallback(async () => {
    const next = await getConferenceStatus()
    if (!next) return
    setMessage(next.message)
    setStatus(next.status)
    if (next.status !== 'running') {
      stopPoll()
      router.refresh()
    }
  }, [router, stopPoll])

  const poll = useCallback(() => {
    stopPoll()
    void pollOnce()
    pollRef.current = setInterval(() => {
      void pollOnce()
    }, POLL_MS)
  }, [pollOnce, stopPoll])

  useEffect(() => {
    if (initial?.status !== 'running') return stopPoll

    const interval = setInterval(() => {
      void pollOnce()
    }, POLL_MS)
    pollRef.current = interval

    return () => {
      clearInterval(interval)
      if (pollRef.current === interval) pollRef.current = null
    }
  }, [initial?.status, pollOnce, stopPoll])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])

  const start = useCallback(async () => {
    setStarting(true)
    setStatus('running')
    setMessage('Starting background cache refresh.')
    setElapsed(0)
    poll()

    fetch('/api/comms/conferences', { method: 'POST' })
      .then(async (response) => {
        if (response.ok) return
        const payload = await response.json().catch(() => null) as { error?: string } | null
        setStatus('error')
        setMessage(payload?.error ?? 'Could not start the cache refresh.')
        stopPoll()
      })
      .catch((error: unknown) => {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Could not start the cache refresh.')
        stopPoll()
      })
      .finally(() => {
        setStarting(false)
        void pollOnce()
      })
  }, [poll, pollOnce, stopPoll])

  return { status, running, starting, busy, elapsed, message: progress, start }
}
