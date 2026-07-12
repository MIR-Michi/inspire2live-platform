'use client'

import { useRef, useState, useTransition } from 'react'
import {
  deleteRawTranscript,
  deleteTranscript,
  runMeetingSummary,
  saveMeetingSummary,
  uploadTranscript,
  type TranscriptActionState,
} from '@/app/app/comms/transcripts/actions'
import { FollowUpTasksPanel } from '@/components/comms/follow-up-tasks-panel'
import type { MeetingTranscriptView } from '@/lib/comms-meeting-transcripts'

type Option = { id: string; label: string }

export type MeetingContext =
  | { kind: 'weekly'; meetingDate: string }
  | { kind: 'campus'; campusSessionId: string }

const INITIAL_STATE: TranscriptActionState = { ok: false }

export function MeetingTranscriptPanel({
  context,
  transcript,
  owners,
  aiEnabled,
}: {
  context: MeetingContext
  transcript: MeetingTranscriptView | null
  owners: Option[]
  aiEnabled: boolean
}) {
  const [state, setState] = useState<TranscriptActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const run = (
    action: (s: TranscriptActionState, fd: FormData) => Promise<TranscriptActionState>,
    fields: Record<string, string>
  ) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    startTransition(async () => setState(await action(INITIAL_STATE, fd)))
  }

  const onUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fd = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await uploadTranscript(INITIAL_STATE, fd)
      setState(result)
      if (result.ok) {
        formRef.current?.reset()
        setAdding(false)
      }
    })
  }

  const summary = transcript?.summary ?? null

  // ── No transcript yet: compact add affordance ──
  if (!transcript) {
    return (
      <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-3">
        {!adding ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-700">
              <span className="font-semibold">Meeting transcript</span> — upload one to generate an AI summary and follow-up tasks for this meeting.
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
            >
              + Add transcript
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={onUpload} className="space-y-3">
            <input type="hidden" name={context.kind === 'weekly' ? 'meeting_date' : 'campus_session_id'} value={context.kind === 'weekly' ? context.meetingDate : context.campusSessionId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Transcript file</span>
                <input type="file" name="file" accept=".txt,.vtt,.srt,.docx" required className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-orange-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-orange-700" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-neutral-700">Title (optional)</span>
                <input type="text" name="title" placeholder="Defaults to the filename" className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
              </label>
            </div>
            <p className="text-[11px] text-neutral-500">.txt, .vtt, .srt, or .docx · max 25MB · comms-only access</p>
            {state.error && <p className="text-xs text-red-700">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:bg-orange-300">
                {pending ? 'Uploading…' : 'Upload transcript'}
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  // ── Transcript present ──
  return (
    <div className="space-y-3 rounded-xl border border-orange-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">📄 {transcript.title}</p>
          <p className="text-[11px] text-neutral-500">
            {transcript.sourceFormat.toUpperCase()} · {transcript.characterCount.toLocaleString()} chars
            {transcript.rawDeleted ? ' · raw file deleted' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {transcript.hasRawFile && !transcript.rawDeleted && (
            <button type="button" onClick={() => run(deleteRawTranscript, { transcript_id: transcript.id })} disabled={pending} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60" title="Delete the raw upload but keep the summary">
              Delete raw file
            </button>
          )}
          <button type="button" onClick={() => run(deleteTranscript, { transcript_id: transcript.id })} disabled={pending} className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            Remove
          </button>
        </div>
      </div>

      {!summary ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-xs text-blue-900">Generate a structured summary (TL;DR, decisions, action items, publication blurb) and follow-up tasks.</p>
          <button type="button" onClick={() => run(runMeetingSummary, { transcript_id: transcript.id })} disabled={pending || !aiEnabled} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-300" title={aiEnabled ? undefined : 'AI features are disabled'}>
            {pending ? 'Summarizing…' : 'Summarize meeting'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-700">AI summary</p>
              {aiEnabled && (
                <button type="button" onClick={() => run(runMeetingSummary, { transcript_id: transcript.id })} disabled={pending} className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-60">
                  Regenerate
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-blue-950">{summary.tldr}</p>

            {summary.decisions.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold text-blue-800">Decisions</p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-blue-950">
                  {summary.decisions.map((d, i) => (
                    <li key={i}>{d.decision}{d.owner ? <span className="text-blue-700"> — {d.owner}</span> : null}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.publicationBlurb && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-blue-800">Publication blurb</summary>
                <p className="mt-1 whitespace-pre-line rounded bg-white/70 px-2 py-1.5 text-xs leading-6 text-blue-950">{summary.publicationBlurb}</p>
              </details>
            )}

            {context.kind === 'campus' && summary.status === 'pending' && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => run(saveMeetingSummary, { summary_id: summary.id, campus_session_id: context.campusSessionId, agenda_item_id: 'none' })}
                  disabled={pending}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-300"
                  title="Write the TL;DR, decisions, and action items onto this campus session"
                >
                  {pending ? 'Saving…' : 'Save to session'}
                </button>
              </div>
            )}
            {context.kind === 'campus' && summary.status === 'saved' && (
              <p className="mt-2 text-[11px] font-medium text-emerald-700">✓ Saved to this campus session.</p>
            )}
          </div>

          <FollowUpTasksPanel proposals={transcript.followUpProposals} owners={owners} summaryId={summary.id} aiEnabled={aiEnabled} />
        </div>
      )}

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}
    </div>
  )
}
