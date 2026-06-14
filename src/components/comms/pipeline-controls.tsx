'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPipeline, updatePipeline } from '@/app/app/comms/crm/pipeline-actions'
import type { CrmPipelineSummary } from '@/lib/comms-crm'

// Sensible starting stages, in the spirit of HubSpot's default deal stages but
// trimmed down. Editable in the wizard before the pipeline is created.
const DEFAULT_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won']

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-orange-600' : 'bg-neutral-200'}`} />
      ))}
    </div>
  )
}

function CreateWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES)

  const cleanStages = stages.map((s) => s.trim()).filter(Boolean)
  const canContinueDetails = name.trim().length > 0
  const canCreate = canContinueDetails && cleanStages.length > 0

  const updateStage = (index: number, value: string) =>
    setStages((prev) => prev.map((s, i) => (i === index ? value : s)))
  const addStage = () => setStages((prev) => [...prev, ''])
  const removeStage = (index: number) => setStages((prev) => prev.filter((_, i) => i !== index))
  const moveStage = (index: number, direction: -1 | 1) =>
    setStages((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  return (
    <Modal title="Create a pipeline" onClose={onClose}>
      <StepDots step={step} total={3} />

      {/* The named hidden inputs carry the wizard state to the server action so
          every step's data is submitted regardless of which step is visible. */}
      <form action={createPipeline} className="space-y-4">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="stage_names" value={cleanStages.join('\n')} />

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Give your pipeline a clear name and an optional description.</p>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-neutral-800">Pipeline name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="e.g. Conference speaker outreach"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-neutral-800">Description <span className="font-normal text-neutral-400">(optional)</span></span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this funnel for?"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Define the stages people move through, in order. You can fine-tune these any time later.
            </p>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-neutral-400">{index + 1}</span>
                  <input
                    value={stage}
                    onChange={(e) => updateStage(index, e.target.value)}
                    placeholder="Stage name"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => moveStage(index, -1)} disabled={index === 0} aria-label="Move stage up" className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => moveStage(index, 1)} disabled={index === stages.length - 1} aria-label="Move stage down" className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">↓</button>
                    <button type="button" onClick={() => removeStage(index)} disabled={stages.length === 1} aria-label="Remove stage" className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-100 disabled:opacity-40">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addStage} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              + Add stage
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Review and create.</p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-semibold text-neutral-900">{name.trim() || 'Untitled pipeline'}</p>
              {description.trim() && <p className="mt-1 text-sm text-neutral-600">{description.trim()}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {cleanStages.map((stage, index) => (
                  <span key={index} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {index + 1}. {stage}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as 1 | 2 | 3))}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !canContinueDetails : cleanStages.length === 0}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Create pipeline
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

function EditModal({ pipeline, onClose }: { pipeline: CrmPipelineSummary; onClose: () => void }) {
  return (
    <Modal title="Edit pipeline" onClose={onClose}>
      <form action={updatePipeline} onSubmit={onClose} className="space-y-4">
        <input type="hidden" name="pipeline_id" value={pipeline.id} />
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Pipeline name</span>
          <input
            name="name"
            defaultValue={pipeline.name}
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-neutral-800">Description <span className="font-normal text-neutral-400">(optional)</span></span>
          <textarea
            name="description"
            defaultValue={pipeline.description ?? ''}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-orange-300 focus:ring"
          />
        </label>
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          Stages and people are managed directly on the board below.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function PipelineControls({
  pipelines,
  activeId,
}: {
  pipelines: CrmPipelineSummary[]
  activeId: string | null
}) {
  const router = useRouter()
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const active = pipelines.find((pipeline) => pipeline.id === activeId) ?? null

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {pipelines.length > 1 && (
          <select
            value={activeId ?? ''}
            onChange={(event) => router.push(`/app/comms/crm/pipelines?pipeline=${event.target.value}`)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none ring-orange-300 focus:ring"
            aria-label="Switch pipeline"
          >
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        )}

        {active && (
          <button
            type="button"
            onClick={() => setModal('edit')}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Edit
          </button>
        )}

        <button
          type="button"
          onClick={() => setModal('create')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
        >
          <span className="text-base leading-none">+</span> Create pipeline
        </button>
      </div>

      {modal === 'create' && <CreateWizard onClose={() => setModal('none')} />}
      {modal === 'edit' && active && <EditModal pipeline={active} onClose={() => setModal('none')} />}
    </>
  )
}
