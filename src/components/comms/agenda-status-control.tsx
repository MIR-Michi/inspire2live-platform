'use client'

import { updateAgendaItemStatus } from '@/app/app/comms/dashboard/actions'
import { UNIFIED_STATUS_ORDER, UNIFIED_STATUS_META, type UnifiedStatus } from '@/lib/comms-status'

export function AgendaStatusControl({
  itemId,
  status,
}: {
  itemId: string
  status: UnifiedStatus
}) {
  return (
    <form action={updateAgendaItemStatus} className="inline-flex">
      <input type="hidden" name="agenda_item_id" value={itemId} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Update agenda item status"
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${UNIFIED_STATUS_META[status].badgeClass}`}
      >
        {UNIFIED_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {UNIFIED_STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  )
}
