import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Guest reports surfaced on the comms operating page.
 *
 * Everything a guest submits through their magic-link workspace
 * (registration, meeting summary, photos, presentations, comments) is stored
 * against the conference. This loader reads it back for the operating page so
 * the comms team always sees the guest's latest information and files — the
 * two views stay in sync because they read and write the same rows.
 */

export type GuestReportFile = {
  id: string
  fileType: 'photo' | 'presentation' | 'document'
  fileName: string
  publicUrl: string | null
  uploadedAt: string
}

export type GuestReportNote = {
  id: string
  noteType: 'summary' | 'comment'
  content: string
  createdAt: string
}

export type ConferenceGuestReport = {
  id: string
  submitterName: string
  submitterEmail: string | null
  submitterOrganisation: string | null
  role: string
  isRegistered: boolean
  status: 'pending' | 'approved' | 'rejected'
  formNotes: string | null
  createdAt: string
  summary: string | null
  comments: GuestReportNote[]
  files: GuestReportFile[]
}

export async function loadConferenceGuestReports(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  conferenceId: string
): Promise<ConferenceGuestReport[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: subs, error } = await db
    .from('conference_guest_submissions')
    .select('id, submitter_name, submitter_email, submitter_organisation, role_at_conference, is_registered, status, notes, created_at')
    .eq('conference_id', conferenceId)
    .order('created_at', { ascending: false })

  if (error || !subs || subs.length === 0) return []

  const ids = subs.map((s: Record<string, unknown>) => String(s.id))

  const [filesRes, notesRes] = await Promise.all([
    db.from('conference_guest_files')
      .select('id, submission_id, file_type, file_name, public_url, uploaded_at')
      .in('submission_id', ids),
    db.from('conference_guest_notes')
      .select('id, submission_id, note_type, content, created_at')
      .in('submission_id', ids),
  ])

  const filesBySub = new Map<string, GuestReportFile[]>()
  for (const f of (filesRes.data ?? []) as Record<string, unknown>[]) {
    const key = String(f.submission_id)
    const arr = filesBySub.get(key) ?? []
    arr.push({
      id: String(f.id),
      fileType: (String(f.file_type) as GuestReportFile['fileType']),
      fileName: String(f.file_name),
      publicUrl: (f.public_url as string | null) ?? null,
      uploadedAt: String(f.uploaded_at),
    })
    filesBySub.set(key, arr)
  }

  const notesBySub = new Map<string, GuestReportNote[]>()
  for (const n of (notesRes.data ?? []) as Record<string, unknown>[]) {
    const key = String(n.submission_id)
    const arr = notesBySub.get(key) ?? []
    arr.push({
      id: String(n.id),
      noteType: (String(n.note_type) as GuestReportNote['noteType']),
      content: String(n.content),
      createdAt: String(n.created_at),
    })
    notesBySub.set(key, arr)
  }

  return subs.map((s: Record<string, unknown>): ConferenceGuestReport => {
    const notes = notesBySub.get(String(s.id)) ?? []
    const summary = notes.find((n) => n.noteType === 'summary')?.content ?? null
    const comments = notes
      .filter((n) => n.noteType === 'comment')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const files = (filesBySub.get(String(s.id)) ?? []).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
    return {
      id: String(s.id),
      submitterName: String(s.submitter_name ?? 'Guest'),
      submitterEmail: (s.submitter_email as string | null) ?? null,
      submitterOrganisation: (s.submitter_organisation as string | null) ?? null,
      role: String(s.role_at_conference ?? 'attendee'),
      isRegistered: Boolean(s.is_registered),
      status: (String(s.status ?? 'pending') as ConferenceGuestReport['status']),
      formNotes: (s.notes as string | null) ?? null,
      createdAt: String(s.created_at),
      summary,
      comments,
      files,
    }
  })
}
