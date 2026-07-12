'use client'

import { useState, useTransition } from 'react'
import {
  commitFollowUpTask,
  regenerateFollowUpTasks,
  rejectFollowUpTask,
  type FollowUpActionState,
} from '@/app/app/comms/transcripts/follow-up-actions'

type OwnerOption = { id: string; label: string }

export type FollowUpProposal = {
  id: string
  title: string
  description: string | null
  proposedOwnerId: string | null
  proposedOwnerLabel: string | null
  ownerMatch: 'matched' | 'unmatched'
  dueDate: string | null
  rawOwner: string | null
  rawDue: string | null
  status: string
}

const INITIAL_STATE: FollowUpActionState = { ok: false }

function ProposalRow({ proposal, owners }: { proposal: FollowUpProposal; owners: OwnerOption[] }) {
  const [title, setTitle] = useState(proposal.title)
  const [ownerId, setOwnerId] = useState(proposal.proposedOwnerId ?? 'none')
  const [dueDate, setDueDate] = useState(proposal.dueDate ?? '')
  const [state, setState] = useState<FollowUpActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const onCommit = () => {
    const formData = new FormData()
    formData.set('proposal_id', proposal.id)
    formData.set('title', title)
    formData.set('owner_id', ownerId)
    formData.set('due_date', dueDate)
    startTransition(async () => setState(await commitFollowUpTask(INITIAL_STATE, formData)))
  }

  const onReject = () => {
    const formData = new FormData()
    formData.set('proposal_id', proposal.id)
    startTransition(async () => setState(await rejectFollowUpTask(INITIAL_STATE, formData)))
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-emerald-800">Task title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-emerald-200 px-3 py-1.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-emerald-800">Owner</span>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 px-2 py-1.5 text-sm"
            >
              <option value="none">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-emerald-800">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      {(proposal.ownerMatch === 'unmatched' && proposal.rawOwner) || proposal.rawDue ? (
        <p className="text-xs text-emerald-700">
          {proposal.ownerMatch === 'unmatched' && proposal.rawOwner ? `Transcript named "${proposal.rawOwner}" (no team match — assign an owner). ` : ''}
          {proposal.rawDue && !proposal.dueDate ? `Due hint: "${proposal.rawDue}" — set an exact date.` : ''}
        </p>
      ) : null}

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={pending || !title.trim()}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:bg-emerald-300"
        >
          {pending ? 'Committing…' : 'Accept & create task'}
        </button>
      </div>
    </div>
  )
}

export function FollowUpTasksPanel({
  proposals,
  owners,
  summaryId,
  aiEnabled,
}: {
  proposals: FollowUpProposal[]
  owners: OwnerOption[]
  summaryId: string
  aiEnabled: boolean
}) {
  const [state, setState] = useState<FollowUpActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const pendingProposals = proposals.filter((p) => p.status === 'pending')
  const committed = proposals.filter((p) => p.status === 'committed')
  const rejected = proposals.filter((p) => p.status === 'rejected')

  const onRegenerate = () => {
    const formData = new FormData()
    formData.set('summary_id', summaryId)
    startTransition(async () => setState(await regenerateFollowUpTasks(INITIAL_STATE, formData)))
  }

  if (proposals.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-900">No follow-up tasks proposed yet. Map this meeting&apos;s action items into draft tasks.</p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={pending || !aiEnabled}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:bg-emerald-300"
        >
          {pending ? 'Proposing…' : 'Propose follow-up tasks'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Follow-up tasks · review &amp; commit</p>
        {aiEnabled && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={pending}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          >
            Re-propose
          </button>
        )}
      </div>

      {(state.error || state.message) && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.ok ? state.message : state.error}</p>
      )}

      {pendingProposals.length > 0 ? (
        <div className="space-y-3">
          {pendingProposals.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} owners={owners} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-emerald-800">All proposed tasks have been reviewed.</p>
      )}

      {(committed.length > 0 || rejected.length > 0) && (
        <div className="space-y-1 border-t border-emerald-200 pt-3 text-xs text-emerald-800">
          {committed.map((proposal) => (
            <p key={proposal.id}>✓ Created: {proposal.title}</p>
          ))}
          {rejected.map((proposal) => (
            <p key={proposal.id} className="text-neutral-500">✕ Rejected: {proposal.title}</p>
          ))}
        </div>
      )}
    </div>
  )
}
