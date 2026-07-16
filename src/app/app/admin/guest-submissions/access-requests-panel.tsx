'use client'

import { useActionState, useState } from 'react'
import {
  decideGuestAccessRequest,
  type AccessDecisionState,
} from '@/app/app/comms/conferences/access-request-actions'
import { ROLE_LABELS, type PlatformRole } from '@/lib/role-access'

export type GuestAccessRequestView = {
  id: string
  contactName: string
  contactEmail: string | null
  conferenceName: string
  message: string | null
  status: 'pending' | 'granted' | 'declined'
  requestedRole: string
  responseMessage: string | null
  createdAt: string
  reviewedAt: string | null
}

const INVITABLE_ROLES: PlatformRole[] = [
  'PatientAdvocate',
  'Clinician',
  'Researcher',
  'Moderator',
  'Comms',
  'HubCoordinator',
  'IndustryPartner',
  'BoardMember',
]

const STATUS_STYLE = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  granted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  declined: 'border-neutral-200 bg-neutral-50 text-neutral-500',
}

export function AccessRequestsPanel({
  requests,
  canManage,
}: {
  requests: GuestAccessRequestView[]
  canManage: boolean
}) {
  const pending = requests.filter((request) => request.status === 'pending')
  const reviewed = requests.filter((request) => request.status !== 'pending')

  return (
    <section id="access-requests" className="mx-auto max-w-4xl space-y-4 scroll-mt-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Platform access</p>
          <h2 className="text-xl font-semibold text-neutral-900">Guest access requests</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Review requests from conference guests. Approval sends the standard platform invitation and a decision email; decline sends the response message by email.
          </p>
        </div>
        <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">
          {pending.length} pending
        </span>
      </header>

      {!canManage && pending.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          These requests are visible to the communications team, but only a PlatformAdmin can approve or decline platform access.
        </p>
      )}

      {requests.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">
          No platform access requests yet.
        </p>
      )}

      {pending.map((request) => (
        <AccessRequestCard key={request.id} request={request} canManage={canManage} />
      ))}

      {reviewed.length > 0 && (
        <details className="rounded-xl border border-neutral-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-700">
            Reviewed access requests ({reviewed.length})
          </summary>
          <div className="space-y-3 border-t border-neutral-100 p-3">
            {reviewed.map((request) => (
              <AccessRequestCard key={request.id} request={request} canManage={false} />
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function AccessRequestCard({
  request,
  canManage,
}: {
  request: GuestAccessRequestView
  canManage: boolean
}) {
  const [responseMessage, setResponseMessage] = useState(request.responseMessage ?? '')
  const [role, setRole] = useState<PlatformRole>(
    INVITABLE_ROLES.includes(request.requestedRole as PlatformRole)
      ? request.requestedRole as PlatformRole
      : 'PatientAdvocate'
  )
  const [state, action, pending] = useActionState<AccessDecisionState, FormData>(
    decideGuestAccessRequest,
    { ok: false }
  )

  return (
    <article className={`rounded-xl border bg-white shadow-sm ${request.status === 'pending' ? 'border-amber-200' : 'border-neutral-200'}`}>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">{request.contactName}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[request.status]}`}>
                {request.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {request.contactEmail ?? 'No email'} · {request.conferenceName}
            </p>
            <p className="mt-1 text-[10px] text-neutral-400">
              Requested {new Date(request.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        {request.message && (
          <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5 text-sm text-orange-900">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-500">Guest message</p>
            <p className="whitespace-pre-wrap">{request.message}</p>
          </div>
        )}

        {request.status !== 'pending' && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Decision</p>
            <p>{request.status === 'granted' ? `Approved as ${ROLE_LABELS[role]}.` : 'Declined.'}</p>
            {request.responseMessage && <p className="mt-1 whitespace-pre-wrap text-neutral-600">{request.responseMessage}</p>}
            {request.reviewedAt && (
              <p className="mt-1 text-[10px] text-neutral-400">
                {new Date(request.reviewedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </div>
        )}

        {request.status === 'pending' && canManage && (
          <div className="space-y-3 border-t border-neutral-100 pt-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Role when approved</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as PlatformRole)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                {INVITABLE_ROLES.map((value) => (
                  <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Message to requester</span>
              <textarea
                value={responseMessage}
                onChange={(event) => setResponseMessage(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional context included in the decision email…"
                className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <DecisionForm
                action={action}
                requestId={request.id}
                decision="approve"
                role={role}
                responseMessage={responseMessage}
                pending={pending}
              />
              <DecisionForm
                action={action}
                requestId={request.id}
                decision="decline"
                role={role}
                responseMessage={responseMessage}
                pending={pending}
              />
            </div>

            {state.error && <p className="text-xs text-red-600">{state.error}</p>}
            {state.message && <p className="text-xs text-emerald-700">{state.message}</p>}
          </div>
        )}
      </div>
    </article>
  )
}

function DecisionForm({
  action,
  requestId,
  decision,
  role,
  responseMessage,
  pending,
}: {
  action: (payload: FormData) => void
  requestId: string
  decision: 'approve' | 'decline'
  role: PlatformRole
  responseMessage: string
  pending: boolean
}) {
  const approve = decision === 'approve'
  return (
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="responseMessage" value={responseMessage} />
      <button
        type="submit"
        disabled={pending}
        className={approve
          ? 'w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50'
          : 'w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50'}
      >
        {pending ? 'Saving…' : approve ? 'Approve and invite' : 'Decline request'}
      </button>
    </form>
  )
}
