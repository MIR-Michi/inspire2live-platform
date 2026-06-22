'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importCrmContacts } from '@/app/app/comms/crm/actions'
import {
  CRM_IMPORT_TEMPLATE_HEADER,
  CRM_IMPORT_TEMPLATE_SAMPLE,
  type CrmImportResult,
} from '@/lib/comms-crm-import'

export function CrmImportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<CrmImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setCsv('')
    setFileName(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError(null)
    setCsv(await file.text())
  }

  function handleImport() {
    setError(null)
    setResult(null)
    startTransition(async () => {
      try {
        const outcome = await importCrmContacts(csv)
        setResult(outcome)
        if (outcome.created > 0 || outcome.updated > 0) router.refresh()
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : 'Import failed. Please try again.')
      }
    })
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(CRM_IMPORT_TEMPLATE_SAMPLE)}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Import CSV
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Import contacts from CSV</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Email is the identifier — rows with an existing email update that contact, new emails create one.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {result ? (
              <ImportSummary result={result} onClose={close} onAgain={reset} />
            ) : (
              <div className="grid gap-4">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-700">Expected columns (header row required)</p>
                  <code className="mt-1 block break-words font-mono text-[11px] text-neutral-500">
                    {CRM_IMPORT_TEMPLATE_HEADER}
                  </code>
                  <p className="mt-2">
                    Only <span className="font-semibold">email</span> is required. Unknown columns are ignored; missing
                    cells are left untouched on existing contacts. Inspire2Live addresses are always saved as internal.
                  </p>
                  <a
                    href={templateHref}
                    download="crm-contacts-template.csv"
                    className="mt-2 inline-block font-semibold text-orange-700 hover:text-orange-900"
                  >
                    Download template
                  </a>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-neutral-700">Choose a CSV file</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFile}
                    className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-50"
                  />
                  {fileName && <span className="text-[11px] text-neutral-400">Loaded: {fileName}</span>}
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-neutral-700">…or paste CSV directly</span>
                  <textarea
                    value={csv}
                    onChange={(event) => {
                      setCsv(event.target.value)
                      setFileName(null)
                    }}
                    rows={6}
                    placeholder={CRM_IMPORT_TEMPLATE_SAMPLE}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
                  />
                </label>

                {error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={pending || csv.trim() === ''}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? 'Importing…' : 'Import contacts'}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ImportSummary({
  result,
  onClose,
  onAgain,
}: {
  result: CrmImportResult
  onClose: () => void
  onAgain: () => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Created" value={result.created} tone="emerald" />
        <Stat label="Updated" value={result.updated} tone="blue" />
        <Stat label="Skipped" value={result.skipped} tone="neutral" />
      </div>

      <p className="text-sm text-neutral-600">
        Processed {result.totalRows} row{result.totalRows === 1 ? '' : 's'} from the file.
      </p>

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">
            {result.errors.length} row{result.errors.length === 1 ? '' : 's'} needed attention
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-amber-800">
            {result.errors.map((rowError, index) => (
              <li key={`${rowError.line}-${index}`}>
                <span className="font-semibold">Line {rowError.line}</span>
                {rowError.email ? ` (${rowError.email})` : ''}: {rowError.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onAgain}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Import another file
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'blue' | 'neutral' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
  } as const
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</div>
    </div>
  )
}
