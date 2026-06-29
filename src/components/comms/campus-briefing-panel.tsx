'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateCampusBriefingAction } from '@/app/app/comms/campus-log/actions'
import type { CampusBriefing } from '@/lib/ai/campus-briefing'

function formatGeneratedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function CampusBriefingPanel({
  sessionId,
  returnPath,
  briefing,
  generatedAt,
  defaultPresenter,
  defaultTopic,
  isAdmin,
  aiEnabled,
}: {
  sessionId: string | null
  returnPath: string
  briefing: CampusBriefing | null
  generatedAt: string | null
  defaultPresenter: string
  defaultTopic: string
  isAdmin: boolean
  aiEnabled: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [presenter, setPresenter] = useState(defaultPresenter)
  const [topic, setTopic] = useState(defaultTopic)

  // No meeting yet — nothing to attach a briefing to.
  if (!sessionId) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
        Create this month&apos;s meeting first to generate an audience briefing.
      </div>
    )
  }

  const canRegenerate = isAdmin
  const showForm = !briefing || editing
  const generatedLabel = formatGeneratedAt(generatedAt)

  const generate = () => {
    setError(null)
    if (!topic.trim()) {
      setError('Add the topic the presenter will cover.')
      return
    }
    const fd = new FormData()
    fd.set('session_id', sessionId)
    fd.set('presenter', presenter.trim())
    fd.set('topic', topic.trim())
    fd.set('return_path', returnPath)
    startTransition(async () => {
      const result = await generateCampusBriefingAction(fd)
      if (!result.ok) {
        setError(result.message ?? 'Failed to generate briefing.')
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-900">Audience briefing</p>
        <p className="mt-1 text-xs leading-5 text-violet-800">
          AI-generated background on the presenter and topic, so the audience arrives with context. A 3–5 minute read.
        </p>
      </div>

      {pending && (
        <div className="rounded-lg border border-violet-200 bg-white px-4 py-6 text-center">
          <p className="text-sm font-semibold text-violet-900">Researching and writing the briefing…</p>
          <p className="mt-1 text-xs text-neutral-500">This can take up to a minute.</p>
        </div>
      )}

      {!pending && showForm && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          {!aiEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              AI features are disabled for this environment.
            </p>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Presenter</span>
            <input
              value={presenter}
              onChange={(event) => setPresenter(event.target.value)}
              placeholder="Name of the speaker (optional)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-neutral-700">Topic</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What will they present?"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </label>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={pending || !aiEnabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              <span aria-hidden>✨</span> {briefing ? 'Regenerate briefing' : 'Generate briefing'}
            </button>
            {briefing && editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setError(null)
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {!pending && briefing && !editing && (
        <article className="space-y-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold leading-snug text-neutral-900">{briefing.headline}</h3>
            {generatedLabel && <p className="text-[11px] text-neutral-400">Generated {generatedLabel}</p>}
          </header>

          {briefing.presenterIntro && (
            <p className="text-sm leading-6 text-neutral-700">{briefing.presenterIntro}</p>
          )}

          {briefing.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`} className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">{section.heading}</h4>
              <p className="text-sm leading-6 text-neutral-700">{section.body}</p>
            </section>
          ))}

          {briefing.keyTakeaways.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Key takeaways</h4>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-neutral-700">
                {briefing.keyTakeaways.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {briefing.links.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Further reading</h4>
              <ul className="space-y-1.5">
                {briefing.links.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline"
                    >
                      {link.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          {canRegenerate ? (
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setError(null)
              }}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              ✨ Regenerate briefing
            </button>
          ) : (
            <p className="text-[11px] text-neutral-400">Only admins can regenerate this briefing.</p>
          )}
        </article>
      )}
    </div>
  )
}
