import type { MeetingTranscriptSummary } from '@/lib/comms-meeting-transcripts'
import type { FollowUpProposal } from '@/components/comms/follow-up-tasks-panel'

/**
 * Decisions & action items derived by the AI from the meeting transcript.
 *
 * Action items whose owner matched a comms-workspace member become platform
 * tasks (managed in the AI summary panel's follow-up list; they appear on the
 * owner's personal dashboard). Action items for people outside the team are
 * listed separately — not as internal tasks — to be sent later via email or
 * WhatsApp.
 */
export function CampusDecisionsActions({
  summary,
  proposals,
}: {
  summary: MeetingTranscriptSummary | null
  proposals: FollowUpProposal[]
}) {
  const decisions = summary?.decisions ?? []
  const internal = proposals.filter((p) => p.ownerMatch === 'matched')
  const external = proposals.filter((p) => p.ownerMatch !== 'matched')
  const hasAnything = decisions.length > 0 || internal.length > 0 || external.length > 0

  if (!hasAnything) {
    return (
      <p className="px-4 py-6 text-center text-sm text-neutral-500">
        Decisions and action items are extracted by the AI from the meeting transcript. Upload a transcript and run the
        summary above to populate this section.
      </p>
    )
  }

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Decisions */}
      <section>
        <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Decisions</h4>
        {decisions.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {decisions.map((decision, index) => (
              <li key={index} className="px-3 py-2.5">
                <p className="text-sm leading-5 text-neutral-800">{decision.decision}</p>
                {(decision.owner || decision.context) && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {decision.owner ? `Decided by: ${decision.owner}` : ''}
                    {decision.owner && decision.context ? ' · ' : ''}
                    {decision.context ?? ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">No decisions captured.</p>
        )}
      </section>

      {/* Action items — comms team (tasks) */}
      <section>
        <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">
          Action items — comms team
        </h4>
        <p className="mt-1 text-[11px] text-neutral-400">
          Assigned to a team member → tracked as a task on their personal dashboard.
        </p>
        {internal.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-emerald-200 bg-emerald-50/40">
            {internal.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm text-neutral-800">{item.title}</span>
                <span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {item.proposedOwnerLabel ?? 'Team member'}
                  {item.dueDate ? ` · ${item.dueDate}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">No action items for the comms team.</p>
        )}
      </section>

      {/* Action items — external contacts (not tasks) */}
      <section>
        <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">
          Action items — external contacts
        </h4>
        <p className="mt-1 text-[11px] text-neutral-400">
          For people outside the team — not platform tasks. Can be sent later via email or WhatsApp.
        </p>
        {external.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-amber-200 bg-amber-50/40">
            {external.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm text-neutral-800">{item.title}</span>
                {item.rawOwner && (
                  <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {item.rawOwner}
                    {item.dueDate ? ` · ${item.dueDate}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">No action items for external contacts.</p>
        )}
      </section>
    </div>
  )
}
