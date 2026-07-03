'use client'

import { useRef, useState } from 'react'
import { updateFeedbackStatus } from '@/modules/feedback/domain/actions'
import type { FeedbackItem, FeedbackStatus } from '@/modules/feedback/domain/types'

export function FeedbackStatusSelect({ item }: { item: FeedbackItem }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status)
  const [note, setNote] = useState(item.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function save() {
    if (!formRef.current) return
    setBusy(true)
    const fd = new FormData(formRef.current)
    fd.set('id', item.id)
    fd.set('status', status)
    fd.set('admin_note', note)
    await updateFeedbackStatus(fd)
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); save() }} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={item.id} />
      <select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
        className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        <option value="open">Open</option>
        <option value="reviewed">Reviewed</option>
        <option value="resolved">Resolved</option>
      </select>
      <input
        type="text"
        name="admin_note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note…"
        className="w-48 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {saved ? '✓ Saved' : busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
