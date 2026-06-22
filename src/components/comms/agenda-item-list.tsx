'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reorderAgendaItems } from '@/app/app/comms/dashboard/actions'
import { AgendaItemCard } from '@/components/comms/agenda-item-card'
import type { AgendaItemRecord } from '@/lib/comms-agenda'

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}

/**
 * Renders agenda topics as a drag-and-drop sortable list. Only the grip handle
 * initiates the drag (so editing inputs stay usable). Reordering updates the
 * order optimistically and persists it via `reorderAgendaItems` — a
 * collaborative action: any comms member can reorder the shared agenda.
 */
export function AgendaItemList({ items }: { items: AgendaItemRecord[] }) {
  const router = useRouter()
  const [order, setOrder] = useState(items)
  const orderRef = useRef(items)
  const draggingId = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  // Re-sync when the server sends a fresh list (e.g. after refresh / add).
  useEffect(() => {
    setOrder(items)
    orderRef.current = items
  }, [items])

  useEffect(() => {
    orderRef.current = order
  }, [order])

  function handleDragStart(id: string) {
    draggingId.current = id
    setDragId(id)
  }

  function handleDragOver(event: React.DragEvent, overId: string) {
    const active = draggingId.current
    if (!active) return
    event.preventDefault()
    if (active === overId) return
    setOrder((prev) => {
      const from = prev.findIndex((i) => i.id === active)
      const to = prev.findIndex((i) => i.id === overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function handleDragEnd() {
    const active = draggingId.current
    draggingId.current = null
    setDragId(null)
    if (!active) return

    const ids = orderRef.current.map((i) => i.id)
    const original = items.map((i) => i.id)
    if (ids.join(',') === original.join(',')) return // unchanged

    const fd = new FormData()
    fd.set('item_ids', JSON.stringify(ids))
    try {
      await reorderAgendaItems(fd)
    } finally {
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      {order.map((item) => (
        <div
          key={item.id}
          onDragOver={(event) => handleDragOver(event, item.id)}
          onDrop={handleDragEnd}
          className={dragId === item.id ? 'opacity-50' : undefined}
        >
          <AgendaItemCard
            item={item}
            dragHandle={
              <span
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragEnd={handleDragEnd}
                className="mt-0.5 cursor-grab text-neutral-300 transition-colors hover:text-neutral-500 active:cursor-grabbing"
                title="Drag to reorder"
                aria-label="Drag to reorder"
              >
                <GripIcon />
              </span>
            }
          />
        </div>
      ))}
    </div>
  )
}
