import {
  CRM_PERSON_TYPE_OPTIONS,
  getCrmPersonTypeLabel,
  getCrmSegmentLabel,
  getInitials,
  type CrmContactRecord,
  type CrmPipelineDetail,
  type CrmPipelineMember,
  type CrmPipelineStage,
} from '@/lib/comms-crm'
import {
  addPipelineMember,
  addPipelineStage,
  movePipelineMember,
  moveStage,
  removePipelineMember,
  removePipelineStage,
  renamePipelineStage,
} from '@/app/app/comms/crm/pipeline-actions'

function MemberAvatar({ member }: { member: CrmPipelineMember }) {
  if (member.pictureUrl) {
    return <img src={member.pictureUrl} alt={member.fullName} className="h-10 w-10 rounded-lg border border-neutral-200 object-cover" />
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
      {getInitials(member.fullName)}
    </div>
  )
}

function MemberCard({
  member,
  pipelineId,
  stages,
  currentStageId,
}: {
  member: CrmPipelineMember
  pipelineId: string
  stages: CrmPipelineStage[]
  currentStageId: string
}) {
  const otherStages = stages.filter((stage) => stage.id !== currentStageId)

  return (
    <li className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-950">{member.fullName}</p>
          {(member.title || member.organisation) && (
            <p className="truncate text-xs text-neutral-600">
              {[member.title, member.organisation].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-600">
              {getCrmSegmentLabel(member.segment)}
            </span>
            {member.personType && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">
                {getCrmPersonTypeLabel(member.personType)}
              </span>
            )}
          </div>
        </div>
      </div>

      {member.note && <p className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700">{member.note}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {otherStages.length > 0 && (
          <form action={movePipelineMember} className="flex items-center gap-1.5">
            <input type="hidden" name="member_id" value={member.id} />
            <input type="hidden" name="pipeline_id" value={pipelineId} />
            <select name="target_stage_id" defaultValue="" className="rounded-lg border border-neutral-200 px-2 py-1 text-xs" required>
              <option value="" disabled>
                Move to…
              </option>
              {otherStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <button className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
              Move
            </button>
          </form>
        )}
        <form action={removePipelineMember}>
          <input type="hidden" name="member_id" value={member.id} />
          <input type="hidden" name="pipeline_id" value={pipelineId} />
          <button className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">
            Remove
          </button>
        </form>
      </div>
    </li>
  )
}

function AddPersonPanel({
  pipelineId,
  stageId,
  records,
}: {
  pipelineId: string
  stageId: string
  records: CrmContactRecord[]
}) {
  const existingContacts = records.filter((record) => record.crmContactId)

  return (
    <details className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-3 text-sm">
      <summary className="cursor-pointer select-none font-semibold text-neutral-700">+ Add a person</summary>

      <div className="mt-3 space-y-3">
        <details className="rounded-lg border border-neutral-200 bg-white p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
            Pick from CRM
          </summary>
          <form action={addPipelineMember} className="mt-2 space-y-2">
            <input type="hidden" name="stage_id" value={stageId} />
            <input type="hidden" name="pipeline_id" value={pipelineId} />
            <input type="hidden" name="mode" value="existing" />
            {existingContacts.length === 0 ? (
              <p className="text-xs text-neutral-500">No CRM contacts saved yet — add people first.</p>
            ) : (
              <select name="contact_id" defaultValue="" required className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
                <option value="" disabled>
                  Choose a person…
                </option>
                {existingContacts.map((record) => (
                  <option key={record.crmContactId} value={record.crmContactId ?? ''}>
                    {record.fullName}
                    {record.organisation ? ` (${record.organisation})` : ''}
                  </option>
                ))}
              </select>
            )}
            <input
              name="note"
              placeholder="Optional note for this stage"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800">
              Add to stage
            </button>
          </form>
        </details>

        <details className="rounded-lg border border-neutral-200 bg-white p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
            Jot down a name
          </summary>
          <form action={addPipelineMember} className="mt-2 space-y-2">
            <input type="hidden" name="stage_id" value={stageId} />
            <input type="hidden" name="pipeline_id" value={pipelineId} />
            <input type="hidden" name="mode" value="ad_hoc" />
            <input
              name="full_name"
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <input
              name="note"
              placeholder="Optional note for this stage"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <p className="text-[11px] text-neutral-500">
              This creates a lightweight external CRM contact so the pipeline always has one source of truth.
            </p>
            <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800">
              Add to stage
            </button>
          </form>
        </details>

        <details className="rounded-lg border border-neutral-200 bg-white p-3">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.08em] text-neutral-600">
            Invite a new internal person
          </summary>
          <form action={addPipelineMember} className="mt-2 space-y-2">
            <input type="hidden" name="stage_id" value={stageId} />
            <input type="hidden" name="pipeline_id" value={pipelineId} />
            <input type="hidden" name="mode" value="invite" />
            <input
              name="full_name"
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email address"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <select name="person_type" defaultValue="" className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
              <option value="">Person type (optional)</option>
              {CRM_PERSON_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              name="note"
              placeholder="Optional note for this stage"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
            />
            <p className="text-[11px] text-neutral-500">
              Creates an internal CRM contact flagged for a platform invitation. Account provisioning itself happens
              outside the CRM — see the connector backlog.
            </p>
            <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800">
              Add &amp; flag for invite
            </button>
          </form>
        </details>
      </div>
    </details>
  )
}

function StageColumn({
  stage,
  pipeline,
  records,
  isFirst,
  isLast,
}: {
  stage: CrmPipelineStage
  pipeline: CrmPipelineDetail
  records: CrmContactRecord[]
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-950">{stage.name}</p>
          <p className="text-xs text-neutral-500">{stage.members.length === 1 ? '1 person' : `${stage.members.length} people`}</p>
        </div>
        <div className="flex items-center gap-1">
          <form action={moveStage}>
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <input type="hidden" name="stage_id" value={stage.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              disabled={isFirst}
              className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Move ${stage.name} earlier`}
            >
              ↑
            </button>
          </form>
          <form action={moveStage}>
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <input type="hidden" name="stage_id" value={stage.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              disabled={isLast}
              className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Move ${stage.name} later`}
            >
              ↓
            </button>
          </form>
        </div>
      </div>

      <details className="rounded-lg border border-neutral-200 bg-white p-2.5 text-xs">
        <summary className="cursor-pointer select-none font-semibold text-neutral-600">Stage settings</summary>
        <div className="mt-2 space-y-2">
          <form action={renamePipelineStage} className="flex items-center gap-1.5">
            <input type="hidden" name="stage_id" value={stage.id} />
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <input
              name="name"
              defaultValue={stage.name}
              required
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
            />
            <button className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
              Rename
            </button>
          </form>
          <form action={removePipelineStage}>
            <input type="hidden" name="stage_id" value={stage.id} />
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <button className="w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">
              Remove stage
            </button>
          </form>
        </div>
      </details>

      <ul className="space-y-2.5">
        {stage.members.map((member) => (
          <MemberCard key={member.id} member={member} pipelineId={pipeline.id} stages={pipeline.stages} currentStageId={stage.id} />
        ))}
        {stage.members.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-3 text-center text-xs text-neutral-500">No one here yet.</p>}
      </ul>

      <AddPersonPanel pipelineId={pipeline.id} stageId={stage.id} records={records} />
    </div>
  )
}

export function CommsCrmPipelineBoard({
  pipeline,
  records,
}: {
  pipeline: CrmPipelineDetail
  records: CrmContactRecord[]
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
          {pipeline.stageCount === 1 ? '1 stage' : `${pipeline.stageCount} stages`}
        </span>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700">
          {pipeline.memberCount === 1 ? '1 person' : `${pipeline.memberCount} people`}
        </span>
      </div>

      {pipeline.stages.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
          This pipeline has no stages yet. Add one below to start moving people through it.
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {pipeline.stages.map((stage, index) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            pipeline={pipeline}
            records={records}
            isFirst={index === 0}
            isLast={index === pipeline.stages.length - 1}
          />
        ))}

        <div className="w-72 shrink-0 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-800">Add a stage</h3>
          <form action={addPipelineStage} className="mt-2 space-y-2">
            <input type="hidden" name="pipeline_id" value={pipeline.id} />
            <input
              name="name"
              required
              placeholder="Stage name"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm"
            />
            <button className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
              Add stage
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
