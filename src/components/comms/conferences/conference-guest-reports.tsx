import type { ConferenceGuestReport } from '@/lib/comms-conference-guest-reports'

/**
 * Read-only panel on the operating page showing what conference guests have
 * submitted through their magic-link workspace: registration, meeting summary,
 * photos, presentations and comments. Kept in sync with the guest workspace
 * because both read the same rows.
 */
export function ConferenceGuestReports({ reports }: { reports: ConferenceGuestReport[] }) {
  if (reports.length === 0) return null

  return (
    <section className="rounded-2xl border border-orange-100 bg-orange-50/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-700">
          Guest reports ({reports.length})
        </h3>
        <span className="text-[11px] text-neutral-500">Submitted via attendance form</span>
      </div>

      <div className="space-y-4">
        {reports.map((r) => (
          <article key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            {/* Who + status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{r.submitterName}</p>
                <p className="truncate text-xs text-neutral-500">
                  {[r.submitterOrganisation, r.submitterEmail].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="neutral">{r.role}</Chip>
                {r.isRegistered && <Chip tone="green">Registered</Chip>}
                <Chip tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'neutral' : 'amber'}>
                  {r.status}
                </Chip>
              </div>
            </div>

            {/* Summary */}
            {r.summary && (
              <div className="mt-3">
                <Label>Meeting summary</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{r.summary}</p>
              </div>
            )}

            {/* Files: photos + presentations/documents */}
            {r.files.length > 0 && (
              <div className="mt-3">
                <Label>Files ({r.files.length})</Label>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {r.files.map((f) => (
                    <li key={f.id}>
                      {f.publicUrl ? (
                        <a
                          href={f.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-neutral-100"
                        >
                          <span>{f.fileType === 'photo' ? '📷' : '📎'}</span>
                          <span className="max-w-[12rem] truncate">{f.fileName}</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                          <span>{f.fileType === 'photo' ? '📷' : '📎'}</span>
                          <span className="max-w-[12rem] truncate">{f.fileName}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comments for the team */}
            {r.comments.length > 0 && (
              <div className="mt-3">
                <Label>Comments for the team</Label>
                <ul className="mt-1.5 space-y-1.5">
                  {r.comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                      {c.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Original free-text note from the form */}
            {r.formNotes && (
              <div className="mt-3">
                <Label>Form note</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{r.formNotes}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{children}</p>
}

function Chip({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'green' | 'amber' }) {
  const styles = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }[tone]
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize ${styles}`}>
      {children}
    </span>
  )
}
