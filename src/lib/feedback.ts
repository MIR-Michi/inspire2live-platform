export type FeedbackType = 'bug' | 'suggestion' | 'question'
export type FeedbackStatus = 'open' | 'reviewed' | 'resolved'

export interface FeedbackItem {
  id: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  page_url: string
  page_title: string | null
  element_path: string | null
  element_text: string | null
  feedback_type: FeedbackType
  message: string
  status: FeedbackStatus
  admin_note: string | null
  created_at: string
}

export const FEEDBACK_TYPE_META: Record<FeedbackType, { label: string; color: string }> = {
  bug:        { label: 'Bug',        color: 'bg-rose-100 text-rose-700' },
  suggestion: { label: 'Suggestion', color: 'bg-blue-100 text-blue-700' },
  question:   { label: 'Question',   color: 'bg-amber-100 text-amber-700' },
}

export const FEEDBACK_STATUS_META: Record<FeedbackStatus, { label: string; color: string }> = {
  open:     { label: 'Open',     color: 'bg-orange-100 text-orange-700' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
}

/** Strips the origin from a full URL to get a path-only string for display. */
export function shortUrl(url: string): string {
  try {
    const { pathname, search } = new URL(url)
    return pathname + (search ? search : '')
  } catch {
    return url
  }
}
