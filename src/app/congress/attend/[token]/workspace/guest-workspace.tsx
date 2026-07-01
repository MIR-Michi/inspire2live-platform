'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type GuestFile = {
  id: string
  fileType: 'photo' | 'presentation' | 'document'
  fileName: string
  publicUrl: string | null
  uploadedAt: string
}

type GuestNote = {
  id: string
  noteType: 'summary' | 'comment'
  content: string
  createdAt: string
}

type Submission = {
  id: string
  submitterName: string
  submitterEmail: string | null
  conferenceName: string
  conferenceId: string | null
  conferenceStart: string | null
  conferenceLocation: string | null
  role: string
  notes: string | null
  isRegistered: boolean
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  files: GuestFile[]
  guestNotes: GuestNote[]
}

type WorkspaceData = {
  token: {
    id: string
    contactName: string | null
    contactEmail: string | null
    conferenceId: string | null
  }
  submissions: Submission[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuestWorkspace({ token }: { token: string }) {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [activeSubId, setActiveSubId] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/congress-guest/workspace?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WorkspaceData | null) => {
        if (!d) { setExpired(true) } else {
          setData(d)
          setActiveSubId(d.submissions[0]?.id ?? null)
        }
        setLoading(false)
      })
      .catch(() => { setExpired(true); setLoading(false) })
  }, [token])

  if (loading) return <Shell><div className="flex items-center justify-center py-24"><Spinner /></div></Shell>
  if (expired || !data) return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mb-4 text-4xl">🔗</div>
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">Link expired</h1>
        <p className="text-sm text-neutral-500">Ask your Inspire2Live contact to send a new link.</p>
      </div>
    </Shell>
  )

  const submission = data.submissions.find((s) => s.id === activeSubId) ?? data.submissions[0] ?? null

  const handleRegisteredChange = async (checked: boolean) => {
    if (!submission) return
    if (checked) {
      await fetch('/api/congress-guest/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, submissionId: submission.id }),
      })
    }
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submission.id ? { ...s, isRegistered: checked } : s
        ),
      }
    })
  }

  const handleFileAdded = (file: GuestFile) => {
    setData((prev) => {
      if (!prev || !submission) return prev
      return {
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submission.id ? { ...s, files: [...s.files, file] } : s
        ),
      }
    })
  }

  const handleNoteUpdated = (note: GuestNote) => {
    setData((prev) => {
      if (!prev || !submission) return prev
      return {
        ...prev,
        submissions: prev.submissions.map((s) => {
          if (s.id !== submission.id) return s
          const existing = s.guestNotes.find((n) => n.id === note.id)
          if (existing) return { ...s, guestNotes: s.guestNotes.map((n) => n.id === note.id ? note : n) }
          return { ...s, guestNotes: [note, ...s.guestNotes] }
        }),
      }
    })
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">Your workspace</p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {submission?.conferenceName ?? 'Conference workspace'}
          </h1>
          {submission && (
            <p className="mt-1 text-sm text-neutral-500">
              {[
                submission.conferenceLocation,
                submission.conferenceStart
                  ? new Date(submission.conferenceStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                  : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Tab picker if multiple submissions */}
        {data.submissions.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {data.submissions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSubId(s.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  s.id === activeSubId
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {s.conferenceName}
              </button>
            ))}
          </div>
        )}

        {submission && (
          <>
            {/* Registration status */}
            <Card>
              <SectionLabel>Registration</SectionLabel>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={submission.isRegistered}
                  onChange={(e) => { void handleRegisteredChange(e.target.checked) }}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-orange-600"
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">I am registered for this conference</p>
                  <p className="text-xs text-neutral-500">
                    Checking this updates the conference pipeline to &ldquo;Registered&rdquo; so the team knows.
                  </p>
                </div>
              </label>
            </Card>

            {/* Summary */}
            <SummarySection
              token={token}
              submission={submission}
              onNoteUpdated={handleNoteUpdated}
            />

            {/* Photos */}
            <UploadSection
              token={token}
              submission={submission}
              accept="image/*"
              fileType="photo"
              label="Photos"
              description="Conference photos, team shots, booth pictures."
              onFileAdded={handleFileAdded}
            />

            {/* Presentation — shown if speaker or panelist */}
            {['speaker', 'panelist', 'organizer'].includes(submission.role) && (
              <UploadSection
                token={token}
                submission={submission}
                accept=".pdf,.ppt,.pptx,.doc,.docx"
                fileType="presentation"
                label="Presentation"
                description="Upload your slides or any document you presented."
                onFileAdded={handleFileAdded}
              />
            )}

            {/* Comments */}
            <CommentsSection
              token={token}
              submission={submission}
              onNoteUpdated={handleNoteUpdated}
            />

            {/* Request full access */}
            <AccessRequestSection token={token} submission={submission} />
          </>
        )}

        {data.submissions.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No submissions yet. Go back and fill in the form.
          </div>
        )}
      </div>
    </Shell>
  )
}

// ─── Summary section ──────────────────────────────────────────────────────────

function SummarySection({
  token,
  submission,
  onNoteUpdated,
}: {
  token: string
  submission: Submission
  onNoteUpdated: (note: GuestNote) => void
}) {
  const existing = submission.guestNotes.find((n) => n.noteType === 'summary')
  const [text, setText] = useState(existing?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/congress-guest/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, submissionId: submission.id, noteType: 'summary', content: text }),
      })
      const data = await res.json() as { ok?: boolean; noteId?: string }
      if (data.ok) {
        setSaved(true)
        onNoteUpdated({ id: data.noteId ?? existing?.id ?? '', noteType: 'summary', content: text, createdAt: new Date().toISOString() })
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <SectionLabel>Meeting summary</SectionLabel>
      <p className="mb-2 text-xs text-neutral-500">
        What happened at the conference? Key takeaways, people you met, sessions you attended.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Write your summary here…"
        className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${saved ? 'text-green-600' : 'text-transparent'}`}>✓ Saved</span>
        <button
          onClick={() => { void save() }}
          disabled={saving || !text.trim()}
          className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save summary'}
        </button>
      </div>
    </Card>
  )
}

// ─── Upload section ───────────────────────────────────────────────────────────

function UploadSection({
  token,
  submission,
  accept,
  fileType,
  label,
  description,
  onFileAdded,
}: {
  token: string
  submission: Submission
  accept: string
  fileType: 'photo' | 'presentation' | 'document'
  label: string
  description: string
  onFileAdded: (file: GuestFile) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const files = submission.files.filter((f) => f.fileType === fileType)

  const handleFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      setError(null)
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('token', token)
        fd.append('submissionId', submission.id)
        fd.append('file', file)

        const res = await fetch('/api/congress-guest/upload', { method: 'POST', body: fd })
        const data = await res.json() as { ok?: boolean; publicUrl?: string; fileType?: string; fileName?: string; fileId?: string; error?: string }
        if (!res.ok || !data.ok) {
          setError(data.error ?? 'Upload failed.')
        } else {
          onFileAdded({
            id: data.fileId ?? Math.random().toString(),
            fileType,
            fileName: data.fileName ?? file.name,
            publicUrl: data.publicUrl ?? null,
            uploadedAt: new Date().toISOString(),
          })
        }
      } catch {
        setError('Upload failed — check your connection.')
      } finally {
        setUploading(false)
      }
    }
  }

  return (
    <Card>
      <SectionLabel>{label}</SectionLabel>
      <p className="mb-3 text-xs text-neutral-500">{description}</p>

      {files.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <span className="text-base">{fileType === 'photo' ? '📷' : '📎'}</span>
              {f.publicUrl ? (
                <a href={f.publicUrl} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-xs font-semibold text-blue-700 hover:underline">
                  {f.fileName}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{f.fileName}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={fileType === 'photo'}
        className="hidden"
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files) }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50 w-full justify-center"
      >
        {uploading ? <><Spinner small /> Uploading…</> : `+ Upload ${label.toLowerCase()}`}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  )
}

// ─── Comments section ─────────────────────────────────────────────────────────

function CommentsSection({
  token,
  submission,
  onNoteUpdated,
}: {
  token: string
  submission: Submission
  onNoteUpdated: (note: GuestNote) => void
}) {
  const comments = submission.guestNotes.filter((n) => n.noteType === 'comment')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  const post = async () => {
    if (!text.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/congress-guest/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, submissionId: submission.id, noteType: 'comment', content: text }),
      })
      const data = await res.json() as { ok?: boolean; noteId?: string }
      if (data.ok) {
        onNoteUpdated({ id: data.noteId ?? Math.random().toString(), noteType: 'comment', content: text, createdAt: new Date().toISOString() })
        setText('')
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card>
      <SectionLabel>Comments for the I2L team</SectionLabel>
      <p className="mb-3 text-xs text-neutral-500">
        Flag anything you want the Inspire2Live team to follow up on, or share additional context.
      </p>

      {comments.length > 0 && (
        <ul className="mb-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
              <p>{c.content}</p>
              <p className="mt-1 text-[10px] text-neutral-400">
                {new Date(c.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <button
          onClick={() => { void post() }}
          disabled={posting || !text.trim()}
          className="self-end rounded-xl bg-neutral-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {posting ? '…' : '→'}
        </button>
      </div>
    </Card>
  )
}

// ─── Access request section ───────────────────────────────────────────────────

function AccessRequestSection({ token, submission }: { token: string; submission: Submission }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      await fetch('/api/congress-guest/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, submissionId: submission.id, message }),
      })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        ✓ Request sent! The Inspire2Live team will be in touch.
      </div>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>Join the platform</SectionLabel>
          <p className="text-xs text-neutral-500">
            Want full access to the Inspire2Live platform? Send a request and the team will set you up.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
          >
            Request access
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Optional: tell us a bit about yourself…"
            className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { void send() }}
              disabled={sending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send request'}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <header className="border-b border-orange-100 bg-white/80 px-4 py-3 backdrop-blur">
        <p className="text-sm font-bold tracking-wide text-orange-700">Inspire2Live</p>
      </header>
      <main>{children}</main>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{children}</p>
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      className={`${small ? 'h-4 w-4' : 'h-8 w-8'} animate-spin rounded-full border-2 border-neutral-200 border-t-orange-500`}
      role="status"
    />
  )
}
