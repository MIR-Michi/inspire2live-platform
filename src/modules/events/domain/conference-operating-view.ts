/**
 * conference-operating-view.ts
 *
 * The unified read model for the conference operating page (Sprint 18, T10).
 *
 * A conference's operating record has two contributors: the comms team (writing
 * `conference_prep`) and invited guests (writing their submission's
 * files/notes, and — since T08 — the shared `conference_prep` fields directly
 * through token RPCs). This pure helper merges both into one picture so the
 * team no longer sees a separate "guest reports" block bolted on beside the
 * operating page — guest photos, summaries, comments, and slides fold into the
 * operating tiles.
 *
 * Kept pure and structurally typed (no server-only import) so it is shared by
 * the operating shell and the unit tests.
 */

export type OperatingPhoto = { url: string; source: 'team' | 'guest'; label: string | null }

export type OperatingNote = { id: string; author: string; content: string; createdAt: string }

export type OperatingPresentation = { id: string; author: string; fileName: string; url: string | null }

/** Structural shape of a guest report (compatible with `ConferenceGuestReport`). */
export type MergeGuestReport = {
  submitterName: string
  summary: string | null
  comments: Array<{ id: string; content: string; createdAt: string }>
  files: Array<{ id: string; fileType: 'photo' | 'presentation' | 'document'; fileName: string; publicUrl: string | null }>
}

export type OperatingView = {
  /** Team photo links ∪ guest photo files, deduped by URL. */
  photos: OperatingPhoto[]
  guestSummaries: OperatingNote[]
  guestComments: OperatingNote[]
  guestPresentations: OperatingPresentation[]
  hasGuestPhotos: boolean
  hasGuestSummary: boolean
}

/** Merge the team prep photos + guest contributions into one operating view. */
export function buildOperatingView(teamPhotoUrls: string[], guestReports: MergeGuestReport[]): OperatingView {
  const photos: OperatingPhoto[] = []
  const seen = new Set<string>()

  const push = (url: string, source: 'team' | 'guest', label: string | null) => {
    const key = url.trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    photos.push({ url: key, source, label })
  }

  for (const url of teamPhotoUrls) push(url, 'team', null)

  const guestSummaries: OperatingNote[] = []
  const guestComments: OperatingNote[] = []
  const guestPresentations: OperatingPresentation[] = []
  let hasGuestPhotos = false

  for (const report of guestReports) {
    const author = report.submitterName || 'Guest'
    if (report.summary && report.summary.trim()) {
      guestSummaries.push({ id: `sum-${author}-${report.summary.length}`, author, content: report.summary, createdAt: '' })
    }
    for (const comment of report.comments) {
      guestComments.push({ id: comment.id, author, content: comment.content, createdAt: comment.createdAt })
    }
    for (const file of report.files) {
      if (file.fileType === 'photo') {
        hasGuestPhotos = true
        if (file.publicUrl) push(file.publicUrl, 'guest', author)
      } else if (file.fileType === 'presentation') {
        guestPresentations.push({ id: file.id, author, fileName: file.fileName, url: file.publicUrl })
      }
    }
  }

  return {
    photos,
    guestSummaries,
    guestComments,
    guestPresentations,
    hasGuestPhotos,
    hasGuestSummary: guestSummaries.length > 0,
  }
}
