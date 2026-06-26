'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { isAiEnabled } from '@/lib/ai/feature-flag'
import {
  extractTranscriptText,
  transcriptFormatFromFilename,
  TranscriptExtractionError,
  type TranscriptFormat,
} from '@/lib/ai/transcript-extract'
import { detectSpeakers, summarizeMeeting } from '@/lib/ai/meeting-summary'
import { generateFollowUpProposals } from '@/lib/ai/follow-up-tasks-store'
import type { Database } from '@/types/database'

export interface TranscriptActionState {
  ok: boolean
  message?: string
  error?: string
}

const INITIAL_STATE: TranscriptActionState = { ok: false }

const TRANSCRIPTS_PATH = '/app/comms/transcripts'
const BUCKET = 'meeting-transcripts'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const CONTENT_TYPE_BY_FORMAT: Record<TranscriptFormat, string> = {
  txt: 'text/plain',
  vtt: 'text/vtt',
  srt: 'application/x-subrip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

type AppSupabaseClient = SupabaseClient<Database>

function asText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableId(value: FormDataEntryValue | null): string | null {
  const text = asText(value)
  return text && text !== 'none' ? text : null
}

async function requireCommsOperator() {
  const supabase = (await createClient()) as AppSupabaseClient
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile || !canAccessCommsWorkspace(profile.role)) {
    throw new Error('Not authorized for the communications workspace')
  }

  return { supabase, user, profile }
}

// New tables (meeting_transcripts / meeting_summaries) are not yet in the
// generated Database types, so we narrow through a minimal structural cast,
// mirroring the intake AI suggestion actions.
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    } & Promise<{ error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> & {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

export async function uploadTranscript(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'Choose a transcript file to upload.' }
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: 'Transcript file is larger than the 25MB limit.' }
    }

    const format = transcriptFormatFromFilename(file.name)
    if (!format) {
      return { ok: false, error: 'Unsupported file type. Upload a .txt, .vtt, .srt, or .docx transcript.' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = extractTranscriptText(buffer, format)

    const title = asText(formData.get('title')) || file.name.replace(/\.[^.]+$/, '')
    const campusSessionId = nullableId(formData.get('campus_session_id'))
    const agendaItemId = nullableId(formData.get('agenda_item_id'))

    const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: CONTENT_TYPE_BY_FORMAT[format], upsert: false })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const db = supabase as unknown as LooseDb
    const { error: insertError } = await db.from('meeting_transcripts').insert({
      title,
      source_filename: file.name,
      source_format: format,
      extracted_text: extracted.text,
      storage_path: storagePath,
      campus_session_id: campusSessionId,
      agenda_item_id: agendaItemId,
      uploaded_by: user.id,
    })
    if (insertError) {
      // Roll back the orphaned storage object so a failed insert leaves no file.
      await supabase.storage.from(BUCKET).remove([storagePath])
      throw new Error(insertError.message)
    }

    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: 'Transcript uploaded and text extracted.' }
  } catch (error) {
    if (error instanceof TranscriptExtractionError) return { ok: false, error: error.message }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not upload transcript.' }
  }
}

export async function runMeetingSummary(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    if (!isAiEnabled()) return { ok: false, error: 'AI features are disabled for this environment.' }

    const { supabase, user } = await requireCommsOperator()
    const transcriptId = asText(formData.get('transcript_id'))
    if (!transcriptId) return { ok: false, error: 'Transcript is required.' }

    const db = supabase as unknown as LooseDb
    const { data: transcript, error: loadError } = await db
      .from('meeting_transcripts')
      .select('id, title, extracted_text')
      .eq('id', transcriptId)
      .maybeSingle()
    if (loadError) throw new Error(loadError.message)
    if (!transcript) throw new Error('Transcript not found.')

    const text = typeof transcript.extracted_text === 'string' ? transcript.extracted_text : ''
    const summary = await summarizeMeeting({
      transcriptId,
      title: typeof transcript.title === 'string' ? transcript.title : null,
      transcript: text,
      knownSpeakers: detectSpeakers(text),
      createdBy: user.id,
    })

    // Replace any previous pending draft for this transcript.
    await db
      .from('meeting_summaries')
      .update({ status: 'superseded' })
      .eq('transcript_id', transcriptId)
      .eq('status', 'pending')

    const { data: inserted, error: insertError } = await db
      .from('meeting_summaries')
      .insert({
        transcript_id: transcriptId,
        tldr: summary.tldr,
        decisions: summary.decisions,
        action_items: summary.actionItems,
        publication_blurb: summary.publicationBlurb,
        chunked: summary.chunked,
        model: summary.model,
        effort: summary.effort,
        raw_response: summary.rawResponse ?? {},
        status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(insertError.message)

    // Same transcript run (S14-T14): map the action items into reviewable
    // follow-up task proposals. Never let proposal generation fail the summary.
    let proposalCount = 0
    if (inserted?.id) {
      try {
        proposalCount = await generateFollowUpProposals(supabase, { summaryId: String(inserted.id), createdBy: user.id })
      } catch (proposalError) {
        console.error('[transcripts] follow-up proposal generation failed', proposalError)
      }
    }

    revalidatePath(TRANSCRIPTS_PATH)
    const base = summary.chunked ? 'Summary generated (long transcript, map-reduced).' : 'Summary generated for review.'
    const tail = proposalCount > 0 ? ` ${proposalCount} follow-up task${proposalCount === 1 ? '' : 's'} proposed.` : ''
    return { ok: true, message: `${base}${tail}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not summarize the meeting.' }
  }
}

type SummaryRow = {
  id: string
  transcript_id: string
  tldr: string
  decisions: Array<{ decision: string; owner?: string | null; context?: string | null }>
  action_items: Array<{ title: string; owner?: string | null; dueDate?: string | null; notes?: string | null }>
  publication_blurb: string | null
  status: string
}

function decisionsToLines(decisions: SummaryRow['decisions']): string[] {
  return decisions.map((d) => (d.owner ? `${d.decision} (${d.owner})` : d.decision))
}

function actionItemsToLines(items: SummaryRow['action_items']): string[] {
  return items.map((item) => {
    const parts = [item.title]
    if (item.owner) parts.push(`owner: ${item.owner}`)
    if (item.dueDate) parts.push(`due: ${item.dueDate}`)
    return parts.join(' — ')
  })
}

export async function saveMeetingSummary(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    const { supabase, user } = await requireCommsOperator()
    const summaryId = asText(formData.get('summary_id'))
    if (!summaryId) return { ok: false, error: 'Summary is required.' }

    const campusSessionId = nullableId(formData.get('campus_session_id'))
    const agendaItemId = nullableId(formData.get('agenda_item_id'))

    const db = supabase as unknown as LooseDb
    const { data, error: loadError } = await db
      .from('meeting_summaries')
      .select('id, transcript_id, tldr, decisions, action_items, publication_blurb, status')
      .eq('id', summaryId)
      .maybeSingle()
    if (loadError) throw new Error(loadError.message)
    const summary = data as SummaryRow | null
    if (!summary) throw new Error('Summary not found.')
    if (summary.status !== 'pending') throw new Error('Only a pending summary can be saved.')

    const { error: updateError } = await db
      .from('meeting_summaries')
      .update({
        status: 'saved',
        campus_session_id: campusSessionId,
        agenda_item_id: agendaItemId,
        saved_by: user.id,
        saved_at: new Date().toISOString(),
      })
      .eq('id', summaryId)
    if (updateError) throw new Error(updateError.message)

    // Filing to a campus session pushes the summary onto that session's
    // publication fields so it surfaces in the campus log.
    if (campusSessionId) {
      const { error: sessionError } = await supabase
        .from('campus_sessions')
        .update({
          summary: summary.tldr,
          decisions_for_publication: decisionsToLines(summary.decisions ?? []),
          action_items_for_publication: actionItemsToLines(summary.action_items ?? []),
        })
        .eq('id', campusSessionId)
      if (sessionError) throw new Error(sessionError.message)
    } else if (agendaItemId) {
      const { error: agendaError } = await db
        .from('comms_weekly_agenda_items')
        .update({ meeting_notes: summary.tldr })
        .eq('id', agendaItemId)
      if (agendaError) throw new Error(agendaError.message)
    }

    revalidatePath(TRANSCRIPTS_PATH)
    const target = campusSessionId ? 'campus session' : agendaItemId ? 'weekly meeting' : 'transcript record (standalone)'
    return { ok: true, message: `Summary saved to the ${target}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the summary.' }
  }
}

export async function discardMeetingSummary(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const summaryId = asText(formData.get('summary_id'))
    if (!summaryId) return { ok: false, error: 'Summary is required.' }

    const db = supabase as unknown as LooseDb
    const { error } = await db.from('meeting_summaries').update({ status: 'discarded' }).eq('id', summaryId)
    if (error) throw new Error(error.message)

    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: 'Summary discarded.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not discard the summary.' }
  }
}

export async function deleteRawTranscript(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const transcriptId = asText(formData.get('transcript_id'))
    if (!transcriptId) return { ok: false, error: 'Transcript is required.' }

    const db = supabase as unknown as LooseDb
    const { data: transcript, error: loadError } = await db
      .from('meeting_transcripts')
      .select('id, storage_path, raw_deleted_at')
      .eq('id', transcriptId)
      .maybeSingle()
    if (loadError) throw new Error(loadError.message)
    if (!transcript) throw new Error('Transcript not found.')

    const storagePath = typeof transcript.storage_path === 'string' ? transcript.storage_path : null
    if (storagePath) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath])
      if (removeError) throw new Error(removeError.message)
    }

    const { error: updateError } = await db
      .from('meeting_transcripts')
      .update({ storage_path: null, raw_deleted_at: new Date().toISOString() })
      .eq('id', transcriptId)
    if (updateError) throw new Error(updateError.message)

    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: 'Raw transcript file deleted. The extracted summary is retained.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the raw transcript.' }
  }
}

export async function deleteTranscript(
  _prevState: TranscriptActionState = INITIAL_STATE,
  formData: FormData
): Promise<TranscriptActionState> {
  try {
    const { supabase } = await requireCommsOperator()
    const transcriptId = asText(formData.get('transcript_id'))
    if (!transcriptId) return { ok: false, error: 'Transcript is required.' }

    const db = supabase as unknown as LooseDb
    const { data: transcript, error: loadError } = await db
      .from('meeting_transcripts')
      .select('id, storage_path')
      .eq('id', transcriptId)
      .maybeSingle()
    if (loadError) throw new Error(loadError.message)
    if (!transcript) throw new Error('Transcript not found.')

    const storagePath = typeof transcript.storage_path === 'string' ? transcript.storage_path : null
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath])

    const { error: deleteError } = await (supabase as unknown as {
      from: (table: string) => { delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } }
    })
      .from('meeting_transcripts')
      .delete()
      .eq('id', transcriptId)
    if (deleteError) throw new Error(deleteError.message)

    revalidatePath(TRANSCRIPTS_PATH)
    return { ok: true, message: 'Transcript and its summaries deleted.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete the transcript.' }
  }
}
