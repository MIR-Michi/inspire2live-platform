'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createFeedbackItem } from '@/modules/feedback/domain/actions'
import { useTestMode } from './test-mode-context'
import type { FeedbackType } from '@/modules/feedback/domain/types'

type CapturedContext = {
  pageUrl: string
  pageTitle: string
  elementPath: string
  elementText: string
}

/** Builds a short CSS-path-like selector for an element, e.g. "main > section > p" */
function getElementPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.body && parts.length < 5) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      selector += `#${current.id}`
    } else if (current.className) {
      const classes = Array.from(current.classList)
        .filter((c) => !c.startsWith('hover:') && !c.startsWith('focus:') && !c.includes(':'))
        .slice(0, 2)
        .join('.')
      if (classes) selector += `.${classes}`
    }
    parts.unshift(selector)
    current = current.parentElement
  }
  return parts.join(' > ')
}

function getElementText(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

// ─── Feedback form modal ──────────────────────────────────────────────────────

function FeedbackModal({
  context,
  onClose,
  onSubmitted,
}: {
  context: CapturedContext
  onClose: () => void
  onSubmitted: () => void
}) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function submit() {
    if (!message.trim()) return
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('page_url', context.pageUrl)
    fd.set('page_title', context.pageTitle)
    fd.set('element_path', context.elementPath)
    fd.set('element_text', context.elementText)
    fd.set('feedback_type', type)
    fd.set('message', message)
    const result = await createFeedbackItem(fd)
    setBusy(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onSubmitted()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-end p-4 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Leave feedback"
    >
      {/* backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100">
              <svg className="h-4 w-4 text-orange-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm.75 5a.75.75 0 00-1.5 0v3.25H6.5a.75.75 0 000 1.5h3.75v.25a.75.75 0 001.5 0v-.25H15a.75.75 0 000-1.5h-3.25V7z" clipRule="evenodd" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold text-neutral-900">Leave feedback</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* context chip */}
          {context.elementText && (
            <div className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">Context: </span>
              <span className="font-mono">{context.elementText}</span>
            </div>
          )}

          {/* type selector */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-neutral-600">Type</p>
            <div className="flex gap-2">
              {(['bug', 'suggestion', 'question'] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    type === t
                      ? t === 'bug'
                        ? 'bg-rose-600 text-white'
                        : t === 'suggestion'
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* message */}
          <div>
            <label htmlFor="fb-message" className="mb-1.5 block text-xs font-medium text-neutral-600">
              Your feedback
            </label>
            <textarea
              id="fb-message"
              ref={textareaRef}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'Describe what went wrong or looks broken…'
                  : type === 'suggestion'
                    ? 'Describe your idea or improvement…'
                    : 'What would you like to know?'
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          {/* page location */}
          <p className="truncate text-[11px] text-neutral-400">
            Page: {context.pageUrl}
          </p>

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!message.trim() || busy}
            className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Success toast ────────────────────────────────────────────────────────────

function SuccessToast({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed bottom-20 right-4 z-[9999] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      Feedback sent — thank you!
    </div>
  )
}

// ─── Main overlay (pick mode + toggle button) ─────────────────────────────────

type HighlightRect = { top: number; left: number; width: number; height: number }

export function FeedbackOverlay() {
  const { isActive, toggle } = useTestMode()
  const pathname = usePathname()

  const [picking, setPicking] = useState(false)
  const [captured, setCaptured] = useState<CapturedContext | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [highlight, setHighlight] = useState<HighlightRect | null>(null)

  // Exit pick mode when navigating to another page. Route changes are an external
  // signal (next/navigation), so resetting the transient pick/capture UI here is the
  // intended use of an effect — synchronising local state to navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicking(false)
    setCaptured(null)
  }, [pathname])

  // Toggle test mode and reset any in-progress pick/capture in the same user action,
  // so re-activating later always starts from a clean state (no effect needed).
  const handleToggle = useCallback(() => {
    setPicking(false)
    setCaptured(null)
    setHighlight(null)
    toggle()
  }, [toggle])

  const enterPickMode = useCallback(() => {
    setHighlight(null)
    setPicking(true)
  }, [])

  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as Element
    if (!target || target.closest('[data-feedback-ui]')) return

    const rect = target.getBoundingClientRect()
    setHighlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
  }, [])

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('[data-feedback-ui]')) return
      e.preventDefault()
      e.stopPropagation()

      const ctx: CapturedContext = {
        pageUrl: window.location.href,
        pageTitle: document.title,
        elementPath: getElementPath(target),
        elementText: getElementText(target),
      }
      setHighlight(null)
      setPicking(false)
      setCaptured(ctx)
    },
    [],
  )

  // Attach/detach the global pick-mode listeners. This only syncs to external systems
  // (document listeners + cursor), which is exactly what effects are for. The highlight
  // box is gated on `picking` in render, so no state reset is needed on teardown.
  useEffect(() => {
    if (!picking) {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('click', handleClick, true)
      document.body.style.cursor = ''
      return
    }

    document.body.style.cursor = 'crosshair'
    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('click', handleClick, true)

    return () => {
      document.body.style.cursor = ''
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('click', handleClick, true)
    }
  }, [picking, handleMouseOver, handleClick])

  // Keyboard: Escape exits pick mode or closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (picking) { setPicking(false); return }
        if (captured) { setCaptured(null); return }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picking, captured])

  if (!isActive) {
    return (
      <button
        type="button"
        data-feedback-ui="toggle"
        onClick={toggle}
        className="fixed bottom-4 right-4 z-[9995] flex items-center gap-1.5 rounded-full border border-orange-500 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-orange-700 active:scale-95"
        title="Activate test mode to leave contextual feedback"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        Test mode
      </button>
    )
  }

  return (
    <>
      {/* Active banner */}
      <div
        data-feedback-ui="banner"
        className="fixed left-0 right-0 top-0 z-[9994] flex items-center justify-between gap-3 bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Test mode active — click anything on the page to leave contextual feedback
        </span>
        <button
          type="button"
          onClick={handleToggle}
          className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-orange-100 hover:bg-orange-700"
        >
          Exit test mode
        </button>
      </div>

      {/* Spacer so page content isn't hidden behind the banner */}
      <div data-feedback-ui="spacer" className="h-10 w-full" aria-hidden="true" />

      {/* Toggle button (in active state = "Pick element" CTA) */}
      {!picking && !captured && (
        <button
          type="button"
          data-feedback-ui="pick-btn"
          onClick={enterPickMode}
          className="fixed bottom-4 right-4 z-[9995] flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-orange-700 active:scale-95"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
          </svg>
          Leave feedback
        </button>
      )}

      {/* Element highlight box (follows the hovered element while picking) */}
      {picking && highlight && (
        <div
          data-feedback-ui="highlight"
          aria-hidden="true"
          className="pointer-events-none fixed z-[9990] rounded-md border-2 border-orange-600 bg-orange-600/10 transition-all duration-75"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      {/* Picking mode hint */}
      {picking && (
        <div
          data-feedback-ui="pick-hint"
          className="fixed bottom-4 left-1/2 z-[9995] -translate-x-1/2 rounded-xl bg-neutral-900/90 px-5 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm"
        >
          Click on any element to attach feedback
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="ml-4 text-xs text-neutral-400 underline hover:text-white"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Feedback modal */}
      {captured && (
        <FeedbackModal
          context={captured}
          onClose={() => setCaptured(null)}
          onSubmitted={() => {
            setCaptured(null)
            setShowSuccess(true)
          }}
        />
      )}

      {/* Success toast */}
      {showSuccess && <SuccessToast onDone={() => setShowSuccess(false)} />}
    </>
  )
}
