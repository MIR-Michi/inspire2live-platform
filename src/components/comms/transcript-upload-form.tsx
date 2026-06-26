'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadTranscript, type TranscriptActionState } from '@/app/app/comms/transcripts/actions'

type Option = { id: string; label: string }

const INITIAL_STATE: TranscriptActionState = { ok: false }

export function TranscriptUploadForm({
  campusSessions,
  agendaItems,
}: {
  campusSessions: Option[]
  agendaItems: Option[]
}) {
  const [state, setState] = useState<TranscriptActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await uploadTranscript(INITIAL_STATE, formData)
      setState(result)
      if (result.ok) formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Upload a transcript</h2>
        <p className="mt-1 text-xs text-neutral-500">Accepted formats: .txt, .vtt, .srt, .docx (max 25MB). Sensitive content is restricted to the comms team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Meeting title</span>
          <input
            type="text"
            name="title"
            placeholder="Optional — defaults to the filename"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Transcript file</span>
          <input
            type="file"
            name="file"
            accept=".txt,.vtt,.srt,.docx"
            required
            className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-700"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Campus session (optional)</span>
          <select name="campus_session_id" defaultValue="none" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            <option value="none">Not linked</option>
            {campusSessions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Weekly agenda item (optional)</span>
          <select name="agenda_item_id" defaultValue="none" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            <option value="none">Not linked</option>
            {agendaItems.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(state.error || state.message) && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:bg-orange-300"
        >
          {pending ? 'Uploading…' : 'Upload transcript'}
        </button>
      </div>
    </form>
  )
}
