'use client'

import { deleteFeedbackItem } from '@/app/app/admin/feedback/actions'

export function FeedbackDeleteButton({ itemId }: { itemId: string }) {
  return (
    <form action={deleteFeedbackItem}>
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        className="text-xs font-medium text-rose-500 hover:underline"
        onClick={(e) => {
          if (!confirm('Delete this feedback item?')) e.preventDefault()
        }}
      >
        Delete
      </button>
    </form>
  )
}
