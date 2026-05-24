'use client'

import { useState } from 'react'
import { ActionModal } from '@/components/ui/action-modal'

const ITEM_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp note' },
  { value: 'sharepoint', label: 'SharePoint asset' },
  { value: 'event', label: 'Event follow-up' },
  { value: 'content', label: 'Content idea' },
] as const

const STEPS = ['Type', 'Content', 'Send', 'Attachments'] as const
const LOCAL_GROUPS = ['World Campus', 'Annual Congress', 'Newsletter leads'] as const
const LOCAL_ATTACHMENTS = ['SharePoint placeholder', 'Photo reference', 'Draft document'] as const

export function NewItemModal() {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [step, setStep] = useState(0)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSaved(false)
          setStep(0)
          setOpen(true)
        }}
        className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
      >
        New item
      </button>

      <ActionModal title="Capture new comms item" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Local planning skeleton only. No WhatsApp, SharePoint, LinkedIn, newsletter, or WordPress action is triggered from this modal.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={`rounded-xl px-2 py-2 text-xs font-semibold ${step === index ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-600'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {step === 0 && (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-neutral-800">Item type</span>
              <select className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" defaultValue="content">
                {ITEM_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Title</span>
                <input className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" placeholder="Short internal label" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-neutral-800">Content</span>
                <textarea className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" rows={5} placeholder="Paste a summary or draft follow-up note" />
              </label>
            </div>
          )}

          {step === 2 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Local distribution placeholders</legend>
              {LOCAL_GROUPS.map((group) => (
                <label key={group} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <input type="checkbox" />
                  {group}
                </label>
              ))}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-neutral-800">Attachment placeholders</legend>
              {LOCAL_ATTACHMENTS.map((attachment) => (
                <label key={attachment} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <input type="checkbox" />
                  {attachment}
                </label>
              ))}
            </fieldset>
          )}

          {saved && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Captured locally in the modal state for review. Persisted workflows remain on the existing intake, planner, events, campus, and library screens.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
              Close
            </button>
            {step > 0 && (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (step < STEPS.length - 1) {
                  setStep((current) => current + 1)
                } else {
                  setSaved(true)
                }
              }}
              className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Save local draft'}
            </button>
          </div>
        </form>
      </ActionModal>
    </>
  )
}
