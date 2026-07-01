'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { reviewGuestSubmission, type ReviewSubmissionState } from '@/app/app/comms/conferences/guest-token-actions'

type Submission = {
  id: string
  submitter_name: string
  submitter_email: string | null
  submitter_phone: string | null
  submitter_organisation: string | null
  conference_name: string
  conference_start_date: string | null
  conference_location: string | null
  role_at_conference: string
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_notes: string | null
  created_at: string
  conference_guest_tokens: { contact_name: string | null; contact_email: string | null }
}

const STATUS_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-green-200 bg-green-50 text-green-800',
  rejected: 'border-neutral-200 bg-neutral-50 text-neutral-500',
}

export function GuestSubmissionsShell({ submissions }: { submissions: Submission[] }) {
  const pending = submissions.filter((s) => s.status === 'pending')
  const reviewed = submissions.filter((s) => s.status !== 'pending')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3 border-b border-neutral-200 pb-4">
        <Link href="/app/comms/conferences" className="inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800">
          Back to Conferences
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Conferences</p>
            <h1 className="text-2xl font-semibold text-neutral-900">Conference attendance reports</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Review forms submitted by invited guests after they receive a personal email or WhatsApp link.
            </p>
          </div>
        </div>
      </header>

      {submissions.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
          No attendance reports yet. Open a conference and use "Invite guest to submit attendance" to send a form link.
        </p>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Pending review ({pending.length})
          </p>
          {pending.map((s) => <SubmissionCard key={s.id} submission={s} />)}
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Reviewed ({reviewed.length})
          </p>
          {reviewed.map((s) => <SubmissionCard key={s.id} submission={s} />)}
        </section>
      )}
    </div>
  )
}

function SubmissionCard({ submission: s }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(s.status === 'pending')
  const [reviewNotes, setReviewNotes] = useState('')
  const [state, action, pending] = useActionState<ReviewSubmissionState, FormData>(reviewGuestSubmission, { ok: false })

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${s.status === 'pending' ? 'border-amber-200' : 'border-neutral-200'}`}>
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">{s.submitter_name}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[s.status]}`}>
                {s.status}
              </span>
            </div>
            <p className="truncate text-xs text-neutral-500">
              {s.conference_name}
              {s.conference_start_date && ` - ${new Date(s.conference_start_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
              {s.conference_location && ` - ${s.conference_location}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="hidden sm:inline">{new Date(s.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold capitalize text-neutral-600">{s.role_at_conference}</span>
          <span className="text-neutral-300">{expanded ? 'Collapse' : 'Open'}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-neutral-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Detail label="Email" value={s.submitter_email} />
            <Detail label="Phone" value={s.submitter_phone} />
            <Detail label="Organisation" value={s.submitter_organisation} />
            <Detail label="Role" value={s.role_at_conference} />
          </div>

          {s.notes && (
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Notes</p>
              {s.notes}
            </div>
          )}

          {s.review_notes && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Review notes</p>
              {s.review_notes}
            </div>
          )}

          {s.status === 'pending' && (
            <div className="space-y-3 pt-1">
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Review notes (optional)..."
                rows={2}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <div className="flex gap-3">
                <form action={action} className="flex-1">
                  <input type="hidden" name="submissionId" value={s.id} />
                  <input type="hidden" name="action" value="approve" />
                  <input type="hidden" name="reviewNotes" value={reviewNotes} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve report
                  </button>
                </form>
                <form action={action} className="flex-1">
                  <input type="hidden" name="submissionId" value={s.id} />
                  <input type="hidden" name="action" value="reject" />
                  <input type="hidden" name="reviewNotes" value={reviewNotes} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Reject report
                  </button>
                </form>
              </div>
              {state.error && (
                <p className="text-xs text-red-600">{state.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-sm text-neutral-700">{value ?? '-'}</p>
    </div>
  )
}
