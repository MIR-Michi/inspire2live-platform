'use client'

export type QueryDiagnosticIssue = {
  scope: string
  message: string
  code?: string
  hint?: string
}

/**
 * Generic Supabase-error panel. Renders nothing when there are no issues, and
 * otherwise surfaces schema-drift / RLS / missing-table errors so a page can
 * degrade visibly instead of silently. Deliberately domain-neutral so any
 * public page can reuse it.
 */
export function QueryDiagnostics({ issues }: { issues: QueryDiagnosticIssue[] }) {
  if (!issues || issues.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
      <p className="font-semibold text-amber-900">Diagnostics</p>
      <p className="mt-0.5 text-amber-800">
        This panel appears when Supabase returns an error (schema drift / RLS / missing tables).
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-900">
        {issues.map((i, idx) => (
          <li key={`${i.scope}-${idx}`}>
            <span className="font-semibold">{i.scope}:</span> {i.message}
            {i.code ? <span className="text-amber-700"> (code: {i.code})</span> : null}
            {i.hint ? <span className="block text-amber-700">hint: {i.hint}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
