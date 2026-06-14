'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCrmPersonTypeLabel,
  getCrmSegmentLabel,
  getInitials,
  type CrmContactRecord,
  type CrmPipelineDetail,
  type CrmPipelineMember,
} from '@/lib/comms-crm'
import {
  addPipelineMember,
  movePipelineMember,
  removePipelineMember,
} from '@/app/app/comms/crm/pipeline-actions'

const SEARCH_MIN_CHARS = 2

function MemberAvatar({ member }: { member: CrmPipelineMember }) {
  if (member.pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.pictureUrl} alt={member.fullName} className="h-9 w-9 rounded-lg border border-neutral-200 object-cover" />
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white">
      {getInitials(member.fullName)}
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
  const router = useRouter()
  const firstStageId = pipeline.stages[0]?.id ?? null

  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragMemberId, setDragMemberId] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  const memberContactIds = useMemo(
    () => new Set(pipeline.stages.flatMap((stage) => stage.members.map((member) => member.contactId))),
    [pipeline.stages],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < SEARCH_MIN_CHARS) return []
    return records
      .filter((record) => {
        if (record.crmContactId && memberContactIds.has(record.crmContactId)) return false
        return [record.fullName, record.organisation, record.email, record.title].some((value) =>
          value?.toLowerCase().includes(q),
        )
      })
      .slice(0, 8)
  }, [query, records, memberContactIds])

  const showResults = query.trim().length >= SEARCH_MIN_CHARS

  async function runAdd(build: (fd: FormData) => void) {
    if (!firstStageId || busy) return
    const fd = new FormData()
    fd.set('stage_id', firstStageId)
    fd.set('pipeline_id', pipeline.id)
    build(fd)
    setBusy(true)
    try {
      await addPipelineMember(fd)
      setQuery('')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  const addExisting = (record: CrmContactRecord) =>
    runAdd((fd) => {
      if (record.crmContactId) {
        fd.set('mode', 'existing')
        fd.set('contact_id', record.crmContactId)
      } else {
        fd.set('mode', 'directory')
        fd.set('source_type', record.sourceType)
        fd.set('source_id', record.sourceId ?? '')
        fd.set('full_name', record.fullName)
        fd.set('segment', record.segment)
      }
    })

  const createNew = () =>
    runAdd((fd) => {
      fd.set('mode', 'ad_hoc')
      fd.set('full_name', query.trim())
    })

  async function handleDrop(stageId: string) {
    const memberId = dragMemberId
    setDragMemberId(null)
    setDragOverStageId(null)
    if (!memberId) return
    const fd = new FormData()
    fd.set('member_id', memberId)
    fd.set('pipeline_id', pipeline.id)
    fd.set('target_stage_id', stageId)
    try {
      await movePipelineMember(fd)
    } finally {
      router.refresh()
    }
  }

  async function handleRemove(memberId: string) {
    const fd = new FormData()
    fd.set('member_id', memberId)
    fd.set('pipeline_id', pipeline.id)
    try {
      await removePipelineMember(fd)
    } finally {
      router.refresh()
    }
  }

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

      {pipeline.stages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
          This pipeline has no stages yet. Use <span className="font-semibold text-neutral-800">Edit</span> to add stages,
          then you can add people.
        </div>
      ) : (
        <>
          {/* Add to pipeline — search-as-you-type; everyone new lands in the first stage. */}
          <div className="relative max-w-md">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Add a person — search by name, organisation or email…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
              aria-label="Add a person to the pipeline"
            />
            {showResults && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
                <ul className="max-h-72 overflow-y-auto">
                  {matches.map((record) => (
                    <li key={record.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addExisting(record)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900">{record.fullName}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {[record.title, record.organisation].filter(Boolean).join(' · ') || getCrmSegmentLabel(record.segment)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-orange-600">Add</span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className="px-3 py-2 text-xs text-neutral-500">No matching contacts in the CRM.</li>
                  )}
                  <li className="border-t border-neutral-100">
                    <button
                      type="button"
                      disabled={busy || !query.trim()}
                      onClick={createNew}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <span className="truncate text-sm text-neutral-700">
                        Create new contact “<span className="font-semibold">{query.trim()}</span>”
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-orange-600">New</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
            <p className="mt-1.5 text-xs text-neutral-400">New people are added to the first stage ({pipeline.stages[0]?.name}).</p>
          </div>

          {/* Board — drag cards between stages */}
          <div className="flex gap-4 overflow-x-auto pb-2">
            {pipeline.stages.map((stage) => {
              const isDropTarget = dragOverStageId === stage.id
              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (dragOverStageId !== stage.id) setDragOverStageId(stage.id)
                  }}
                  onDragLeave={() => setDragOverStageId((current) => (current === stage.id ? null : current))}
                  onDrop={() => handleDrop(stage.id)}
                  className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border p-3 transition-colors ${
                    isDropTarget ? 'border-orange-400 bg-orange-50/60' : 'border-neutral-200 bg-neutral-50/40'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-neutral-950">{stage.name}</p>
                    <p className="text-xs text-neutral-500">{stage.members.length}</p>
                  </div>

                  <ul className="space-y-2.5">
                    {stage.members.map((member) => (
                      <li
                        key={member.id}
                        draggable
                        onDragStart={() => setDragMemberId(member.id)}
                        onDragEnd={() => {
                          setDragMemberId(null)
                          setDragOverStageId(null)
                        }}
                        className={`group cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                          dragMemberId === member.id ? 'opacity-50' : ''
                        }`}
                      >
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
                          <button
                            type="button"
                            onClick={() => handleRemove(member.id)}
                            aria-label={`Remove ${member.fullName}`}
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-rose-50 hover:text-rose-600 group-hover:text-neutral-400"
                          >
                            ✕
                          </button>
                        </div>
                        {member.note && <p className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700">{member.note}</p>}
                      </li>
                    ))}
                    {stage.members.length === 0 && (
                      <li className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-6 text-center text-xs text-neutral-400">
                        Drop here
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
