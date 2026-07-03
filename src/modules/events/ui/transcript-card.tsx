'use client'

import { useState, useTransition } from 'react'
import {
  deleteRawTranscript,
  deleteTranscript,
  discardMeetingSummary,
  runMeetingSummary,
  saveMeetingSummary,
  type TranscriptActionState,
} from '@/app/app/comms/transcripts/actions'
import { FollowUpTasksPanel, type FollowUpProposal } from '@/components/comms/follow-up-tasks-panel'

type Option = { id: string; label: string }

export type TranscriptSummary = {
  id: string
  status: string
  tldr: string
  decisions: Array<{ decision: string; owner?: string | null; context?: string | null }>
  actionItems: Array<{ title: string; owner?: string | null; dueDate?: string | null; notes?: string | null }>
  publicationBlurb: string | null
  chunked: boolean
  model: string | null
}

export type TranscriptCardData = {
  id: string
  title: string
  sourceFilename: string | null
  sourceFormat: string
  rawDeleted: boolean
  hasRawFile: boolean
  createdAt: string
  characterCount: number
  preview: string
  summary: TranscriptSummary | null
  followUpProposals: FollowUpProposal[]
}

const INITIAL_STATE: TranscriptActionState = { ok: false }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function TranscriptCard({
  transcript,
  campusSessions,
  agendaItems,
  owners,
  aiEnabled,
}: {
  transcript: TranscriptCardData
  campusSessions: Option[]
  agendaItems: Option[]
  owners: Option[]
  aiEnabled: boolean
}) {
  const [state, setState] = useState<TranscriptActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const [saveTarget, setSaveTarget] = useState<'standalone' | 'campus' | 'agenda'>('standalone')
  const [campusSessionId, setCampusSessionId] = useState<string>('none')
  const [agendaItemId, setAgendaItemId] = useState<string>('none')

  const summary = transcript.summary

  const run = (
    action: (state: TranscriptActionState, formData: FormData) => Promise<TranscriptActionState>,
    fields: Record<string, string>
  ) => {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) formData.set(key, value)
    startTransition(async () => {
      setState(await action(INITIAL_STATE, formData))
    })
  }

  const onSave = () => {
    run(saveMeetingSummary, {
      summary_id: summary!.id,
      campus_session_id: saveTarget === 'campus' ? campusSessionId : 'none',
      agenda_item_id: saveTarget === 'agenda' ? agendaItemId : 'none',
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{transcript.title}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {transcript.sourceFilename ?? 'transcript'} · {transcript.sourceFormat.toUpperCase()} · {transcript.characterCount.toLocaleString()} chars · {formatDate(transcript.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {transcript.rawDeleted ? (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-500">Raw file deleted</span>
          ) : (
            transcript.hasRawFile && (
              <button
                type="button"
                onClick={() => run(deleteRawTranscript, { transcript_id: transcript.id })}
                disabled={pending}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60"
                title="Delete the raw upload but keep the extracted summary"
              >
                Delete raw file
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => run(deleteTranscript, { transcript_id: transcript.id })}
            disabled={pending}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>

      {transcript.preview && (
        <p className="line-clamp-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{transcript.preview}…</p>
      )}

      {summary ? (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              AI summary {summary.status === 'saved' ? '· saved' : '· pending review'}
            </p>
            <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700">
              {summary.model ?? 'Claude'}
              {summary.chunked ? ' · map-reduced' : ''}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-blue-800">TL;DR</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-blue-950">{summary.tldr}</p>
          </div>

          {summary.decisions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-800">Decisions</p>
              <ul className="mt-1 space-y-1 text-sm text-blue-950">
                {summary.decisions.map((decision, index) => (
                  <li key={index} className="rounded-lg bg-white/70 px-3 py-1.5">
                    {decision.decision}
                    {decision.owner ? <span className="text-blue-700"> — {decision.owner}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.actionItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-800">Action items</p>
              <ul className="mt-1 space-y-1 text-sm text-blue-950">
                {summary.actionItems.map((item, index) => (
                  <li key={index} className="rounded-lg bg-white/70 px-3 py-1.5">
                    {item.title}
                    {item.owner ? <span className="text-blue-700"> · {item.owner}</span> : null}
                    {item.dueDate ? <span className="text-blue-500"> · due {item.dueDate}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.publicationBlurb && (
            <div>
              <p className="text-xs font-semibold text-blue-800">Publication blurb</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-white/70 px-3 py-2 text-sm leading-6 text-blue-950">{summary.publicationBlurb}</p>
            </div>
          )}

          {summary.status === 'pending' && (
            <div className="space-y-3 border-t border-blue-200 pt-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-blue-900">
                <span className="font-semibold">Save to:</span>
                {(['standalone', 'campus', 'agenda'] as const).map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5">
                    <input type="radio" name={`save-target-${transcript.id}`} checked={saveTarget === option} onChange={() => setSaveTarget(option)} />
                    {option === 'standalone' ? 'Standalone' : option === 'campus' ? 'Campus session' : 'Weekly meeting'}
                  </label>
                ))}
              </div>

              {saveTarget === 'campus' && (
                <select value={campusSessionId} onChange={(e) => setCampusSessionId(e.target.value)} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm">
                  <option value="none">Choose a campus session…</option>
                  {campusSessions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              )}
              {saveTarget === 'agenda' && (
                <select value={agendaItemId} onChange={(e) => setAgendaItemId(e.target.value)} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm">
                  <option value="none">Choose a weekly agenda item…</option>
                  {agendaItems.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {aiEnabled && (
                  <button
                    type="button"
                    onClick={() => run(runMeetingSummary, { transcript_id: transcript.id })}
                    disabled={pending}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                  >
                    Regenerate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => run(discardMeetingSummary, { summary_id: summary.id })}
                  disabled={pending}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending || (saveTarget === 'campus' && campusSessionId === 'none') || (saveTarget === 'agenda' && agendaItemId === 'none')}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-300"
                >
                  {pending ? 'Saving…' : 'Save summary'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">Generate a structured summary (TL;DR, decisions, action items, publication blurb).</p>
          <button
            type="button"
            onClick={() => run(runMeetingSummary, { transcript_id: transcript.id })}
            disabled={pending || !aiEnabled}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-300"
            title={aiEnabled ? undefined : 'AI features are disabled'}
          >
            {pending ? 'Summarizing…' : 'Summarize meeting'}
          </button>
        </div>
      )}

      {summary && (
        <FollowUpTasksPanel
          proposals={transcript.followUpProposals}
          owners={owners}
          summaryId={summary.id}
          aiEnabled={aiEnabled}
        />
      )}

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}
    </div>
  )
}
