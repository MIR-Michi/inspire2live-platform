'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConferenceStatus, startConferenceRun } from '@/app/app/comms/conferences/run-actions'
import type { ConferenceRunStatus, ConferenceRunState } from '@/lib/ai/conference-run'

const POLL_MS = 4000
const MAX_CLIENT_WAIT_SECONDS = 360

function progressMessage(elapsed: number, providerMessage: string | null): string | null {
  if (providerMessage) return providerMessage
  if (elapsed < 5) return 'Starting discovery and checking AI configuration.'
  if (elapsed < 30) return 'Searching Europe, North America, and global oncology conference sources.'
  if (elapsed < 75) return 'Searching Asia-Pacific, Latin America, and Middle East / Africa sources.'
  if (elapsed < 120) return 'Validating dates, official URLs, and duplicate conference names.'
  if (elapsed < 180) return 'Saving new conferences and preparing the shortlist view.'
  if (elapsed < 300) return 'Still waiting for slow web-search responses. This should normally finish soon.'
  return 'This is taking longer than expected. The run will be marked as interrupted if it cannot finish.'
}

export function useConferenceRun(initial: ConferenceRunStatus | null) {
  const router = useRouter()
  const [status, setStatus] = useState<ConferenceRunState>(initial?.status ?? 'idle')
  const [message, setMessage] = useState<string | null>(initial?.status === 'running' ? null : initial?.message ?? null)
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

  const poll = useCallback(() => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      const next = await getConferenceStatus()
      if (!next) return
      setMessage(next.message)
      if (next.status === 'running') return
      stopPoll()
      setStatus(next.status)
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

  useEffect(() => {
    if (!running || elapsed < MAX_CLIENT_WAIT_SECONDS) return
    stopPoll()
    setStatus('error')
    setMessage('The discovery run is taking too long. Please refresh the page and try again with a smaller search scope.')
  }, [elapsed, running, stopPoll])

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

  return { status, running, starting, busy, elapsed, message: progress, start }
}
