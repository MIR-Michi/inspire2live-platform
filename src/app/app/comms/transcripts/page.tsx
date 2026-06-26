import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import { TranscriptUploadForm } from '@/components/comms/transcript-upload-form'
import { TranscriptCard, type TranscriptCardData } from '@/components/comms/transcript-card'

type CampusSessionOption = { id: string; label: string }
type AgendaItemOption = { id: string; label: string }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export default async function CommsTranscriptsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCommsWorkspace(profile?.role)) redirect('/app/dashboard')

  const aiEnabled = isAiEnabled()

  const db = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string, opts: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      }
    }
  }

  const [transcriptsRes, summariesRes, sessionsRes, agendaRes] = await Promise.all([
    db.from('meeting_transcripts').select('id, title, source_filename, source_format, storage_path, raw_deleted_at, campus_session_id, agenda_item_id, extracted_text, created_at').order('created_at', { ascending: false }),
    db.from('meeting_summaries').select('id, transcript_id, tldr, decisions, action_items, publication_blurb, status, chunked, model, created_at').order('created_at', { ascending: false }),
    db.from('campus_sessions').select('id, session_date, theme').order('session_date', { ascending: false }),
    db.from('comms_weekly_agenda_items').select('id, title, meeting_date').order('meeting_date', { ascending: false }),
  ])

  const transcriptRows = (transcriptsRes.data ?? []) as Array<Record<string, unknown>>
  const summaryRows = (summariesRes.data ?? []) as Array<Record<string, unknown>>

  const campusSessions: CampusSessionOption[] = ((sessionsRes.data ?? []) as Array<{ id: string; session_date: string; theme: string | null }>).map((s) => ({
    id: s.id,
    label: `${formatDate(s.session_date)}${s.theme ? ` — ${s.theme}` : ''}`,
  }))
  const agendaItems: AgendaItemOption[] = ((agendaRes.data ?? []) as Array<{ id: string; title: string; meeting_date: string }>).map((a) => ({
    id: a.id,
    label: `${formatDate(a.meeting_date)} — ${a.title}`,
  }))

  // Latest non-terminal (pending or saved) summary per transcript drives the card.
  const summaryByTranscript = new Map<string, Record<string, unknown>>()
  for (const row of summaryRows) {
    const tid = String(row.transcript_id)
    const status = String(row.status)
    if (status !== 'pending' && status !== 'saved') continue
    if (!summaryByTranscript.has(tid)) summaryByTranscript.set(tid, row)
  }

  const transcripts: TranscriptCardData[] = transcriptRows.map((row) => {
    const text = typeof row.extracted_text === 'string' ? row.extracted_text : ''
    const summary = summaryByTranscript.get(String(row.id))
    return {
      id: String(row.id),
      title: String(row.title ?? 'Untitled meeting'),
      sourceFilename: (row.source_filename as string | null) ?? null,
      sourceFormat: String(row.source_format ?? ''),
      rawDeleted: Boolean(row.raw_deleted_at),
      hasRawFile: Boolean(row.storage_path),
      createdAt: String(row.created_at),
      characterCount: text.length,
      preview: text.slice(0, 320),
      summary: summary
        ? {
            id: String(summary.id),
            status: String(summary.status),
            tldr: String(summary.tldr ?? ''),
            decisions: (Array.isArray(summary.decisions) ? summary.decisions : []) as NonNullable<TranscriptCardData['summary']>['decisions'],
            actionItems: (Array.isArray(summary.action_items) ? summary.action_items : []) as NonNullable<TranscriptCardData['summary']>['actionItems'],
            publicationBlurb: (summary.publication_blurb as string | null) ?? null,
            chunked: Boolean(summary.chunked),
            model: (summary.model as string | null) ?? null,
          }
        : null,
    }
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">Meeting workspace</p>
          <h1 className="text-2xl font-bold text-neutral-900">Transcript summaries</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Upload a meeting transcript, run an AI summary, then review and save it to a campus session, a weekly meeting, or keep it standalone.
          </p>
        </div>
        <Link href="/app/comms/meetings" className="text-sm font-medium text-orange-600 hover:underline">
          ← Weekly meetings
        </Link>
      </div>

      {!aiEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          AI features are disabled in this environment. You can upload transcripts, but summarization is unavailable until <code>NEXT_PUBLIC_FEATURE_AI</code> is enabled.
        </div>
      )}

      <TranscriptUploadForm campusSessions={campusSessions} agendaItems={agendaItems} />

      <div className="space-y-4">
        {transcripts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-400">
            No transcripts uploaded yet.
          </p>
        ) : (
          transcripts.map((transcript) => (
            <TranscriptCard
              key={transcript.id}
              transcript={transcript}
              campusSessions={campusSessions}
              agendaItems={agendaItems}
              aiEnabled={aiEnabled}
            />
          ))
        )}
      </div>
    </div>
  )
}
