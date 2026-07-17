'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ResizableSplit } from '@/components/ui/resizable-split'
import {
  applyDashboardPreset,
  buildDefaultDashboardLayout,
  getDashboardDefinition,
  moveDashboardWidget,
  sanitizeDashboardLayout,
  updateDashboardWidget,
  type DashboardId,
  type DashboardLayoutState,
  type DashboardPreset,
  type DashboardTileSize,
  type DashboardWidgetContent,
  type DashboardWidgetLayout,
  type DashboardZone,
} from '@/kernel/dashboard'
import { useDesignSystem } from '@/kernel/ui/design-system-context'

const SAVE_DELAY = 550

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type AdaptiveDashboardProps = {
  dashboardId: DashboardId
  initialLayout: DashboardLayoutState
  widgets: DashboardWidgetContent[]
  title?: string
  subtitle?: string
  headerActions?: ReactNode
  kpis?: ReactNode
  readOnly?: boolean
  readOnlyReason?: string
  className?: string
}

function buttonClass(active = false) {
  return [
    'inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
    active
      ? 'border-orange-300 bg-orange-50 text-orange-800'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-orange-300 hover:text-orange-700',
  ].join(' ')
}

function nextIndex(layout: DashboardLayoutState, widget: DashboardWidgetLayout, direction: -1 | 1): number {
  const peers = layout.widgets
    .filter((item) => item.zone === widget.zone && item.size !== 'wide')
    .sort((a, b) => a.order - b.order)
  const current = peers.findIndex((item) => item.id === widget.id)
  return Math.max(0, Math.min(peers.length - 1, current + direction))
}

export function AdaptiveDashboard({
  dashboardId,
  initialLayout,
  widgets,
  title,
  subtitle,
  headerActions,
  kpis,
  readOnly = false,
  readOnlyReason = 'This dashboard is read-only while previewing another user.',
  className = '',
}: AdaptiveDashboardProps) {
  const definition = getDashboardDefinition(dashboardId)
  const design = useDesignSystem()
  const normalizedInitial = useMemo(
    () => sanitizeDashboardLayout(definition, initialLayout, {
      preset: design.defaultPreset,
      splitRatio: design.defaultSplitRatio,
      density: design.density,
    }),
    // The initial server layout is authoritative for this render. A design setting
    // refresh remounts the page through Next.js rather than rewriting a live edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboardId],
  )
  const [layout, setLayout] = useState<DashboardLayoutState>(normalizedInitial)
  const [history, setHistory] = useState<DashboardLayoutState[]>([])
  const [editMode, setEditMode] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [announcement, setAnnouncement] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveSequence = useRef(0)

  const content = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets])
  const definitionById = useMemo(
    () => new Map(definition.widgets.map((widget) => [widget.id, widget])),
    [definition],
  )

  const commit = (next: DashboardLayoutState, message?: string) => {
    if (readOnly) return
    setHistory((previous) => [...previous.slice(-19), layout])
    setLayout(next)
    setDirty(true)
    setSaveState('idle')
    if (message) setAnnouncement(message)
  }

  useEffect(() => {
    if (!dirty || readOnly) return
    const sequence = ++saveSequence.current
    const timer = window.setTimeout(async () => {
      setSaveState('saving')
      try {
        const response = await fetch('/api/dashboard-preferences', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dashboardId, layout }),
        })
        if (!response.ok) throw new Error('Could not save dashboard layout')
        if (sequence === saveSequence.current) {
          setSaveState('saved')
          setDirty(false)
          window.setTimeout(() => setSaveState((state) => state === 'saved' ? 'idle' : state), 1800)
        }
      } catch {
        if (sequence === saveSequence.current) setSaveState('error')
      }
    }, SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [dashboardId, dirty, layout, readOnly])

  const visible = layout.widgets.filter((widget) => widget.visible && content.has(widget.id))
  const wide = visible.filter((widget) => widget.size === 'wide').sort((a, b) => a.order - b.order)
  const primary = visible.filter((widget) => widget.size !== 'wide' && widget.zone === 'primary').sort((a, b) => a.order - b.order)
  const supporting = visible.filter((widget) => widget.size !== 'wide' && widget.zone === 'supporting').sort((a, b) => a.order - b.order)
  const hidden = layout.widgets.filter((widget) => !widget.visible && content.has(widget.id))

  const move = (widgetId: string, zone: DashboardZone, targetIndex: number) => {
    const widget = layout.widgets.find((item) => item.id === widgetId)
    if (!widget) return
    const next = moveDashboardWidget(layout, widgetId, zone, targetIndex)
    commit(next, `${definitionById.get(widgetId)?.title ?? widgetId} moved to ${zone} column, position ${targetIndex + 1}.`)
  }

  const changeWidget = (
    widgetId: string,
    patch: Partial<Pick<DashboardWidgetLayout, 'size' | 'visible' | 'collapsed'>>,
    message: string,
  ) => commit(updateDashboardWidget(definition, layout, widgetId, patch), message)

  const undo = () => {
    const previous = history.at(-1)
    if (!previous || readOnly) return
    setLayout(previous)
    setHistory((items) => items.slice(0, -1))
    setDirty(true)
    setAnnouncement('Last dashboard change undone.')
  }

  const reset = async () => {
    if (readOnly || !window.confirm('Reset this dashboard to the organization default? Your current arrangement will be replaced.')) return
    const next = buildDefaultDashboardLayout(definition, {
      preset: design.defaultPreset,
      splitRatio: design.defaultSplitRatio,
      density: design.density,
    })
    setHistory((previous) => [...previous.slice(-19), layout])
    setLayout(next)
    setSaveState('saving')
    setDirty(false)
    try {
      const response = await fetch(`/api/dashboard-preferences?dashboardId=${encodeURIComponent(dashboardId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Reset failed')
      setSaveState('saved')
      setAnnouncement('Dashboard reset to the organization default.')
    } catch {
      setSaveState('error')
    }
  }

  const applyPreset = (preset: DashboardPreset) => {
    commit(applyDashboardPreset(definition, layout, preset), `${preset} dashboard preset applied.`)
  }

  const dropAtEnd = (zone: DashboardZone) => {
    if (!dragId) return
    const count = layout.widgets.filter((widget) => widget.zone === zone && widget.size !== 'wide').length
    move(dragId, zone, count)
    setDragId(null)
  }

  return (
    <section
      className={[
        'space-y-[var(--i2l-dashboard-gap)]',
        layout.density === 'compact' ? 'text-[0.96rem]' : '',
        className,
      ].join(' ')}
      data-dashboard-id={dashboardId}
    >
      {(title || subtitle || headerActions || !readOnly) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>}
            {subtitle && <p className="mt-1 max-w-3xl text-sm text-neutral-500">{subtitle}</p>}
            {readOnly && <p className="mt-1 text-xs font-medium text-amber-700">{readOnlyReason}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
            {!readOnly && (
              <button type="button" onClick={() => { setEditMode((value) => !value); setShowLibrary(false) }} className={buttonClass(editMode)}>
                {editMode ? 'Done' : 'Edit dashboard'}
              </button>
            )}
          </div>
        </div>
      )}

      {kpis && <div>{kpis}</div>}

      {editMode && !readOnly && (
        <div className="rounded-[var(--i2l-radius-card)] border border-orange-200 bg-orange-50/70 p-3 shadow-[var(--i2l-shadow-card)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-orange-800">Customize</span>
            {(['balanced', 'focus', 'overview'] as const).map((preset) => (
              <button key={preset} type="button" onClick={() => applyPreset(preset)} className={buttonClass(layout.preset === preset)}>
                {preset[0].toUpperCase() + preset.slice(1)}
              </button>
            ))}
            <button type="button" onClick={() => setShowLibrary((value) => !value)} className={buttonClass(showLibrary)}>
              Add tiles{hidden.length ? ` (${hidden.length})` : ''}
            </button>
            <button type="button" onClick={undo} disabled={!history.length} className={`${buttonClass()} disabled:cursor-not-allowed disabled:opacity-40`}>
              Undo
            </button>
            <button type="button" onClick={reset} className={buttonClass()}>Reset</button>
            <span className="ml-auto text-xs text-neutral-500" role="status" aria-live="polite">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : saveState === 'error' ? 'Could not save — try another change.' : 'Changes save automatically'}
            </span>
          </div>
          {showLibrary && (
            <div className="mt-3 border-t border-orange-200 pt-3">
              <p className="text-xs font-semibold text-neutral-700">Hidden tiles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {hidden.map((widget) => (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => changeWidget(widget.id, { visible: true }, `${definitionById.get(widget.id)?.title ?? widget.id} restored.`)}
                    className={buttonClass()}
                  >
                    + {definitionById.get(widget.id)?.title ?? widget.id}
                  </button>
                ))}
                {hidden.length === 0 && <span className="text-xs text-neutral-500">All available tiles are visible.</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {wide.length > 0 && (
        <div className="space-y-[var(--i2l-dashboard-gap)]">
          {wide.map((widget, index) => (
            <DashboardTile
              key={widget.id}
              widget={widget}
              definition={definitionById.get(widget.id)}
              content={content.get(widget.id)}
              editMode={editMode && !readOnly}
              isDragging={dragId === widget.id}
              onDragStart={() => setDragId(widget.id)}
              onDrop={() => { if (dragId) move(dragId, widget.zone, index); setDragId(null) }}
              onChange={changeWidget}
              onMove={(zone, target) => move(widget.id, zone, target)}
              layout={layout}
            />
          ))}
        </div>
      )}

      {focusMode ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setFocusMode(false)} className={buttonClass(true)}>Show supporting column</button>
          </div>
          <DashboardZoneColumn
            zone="primary"
            widgets={primary}
            layout={layout}
            content={content}
            definitions={definitionById}
            editMode={editMode && !readOnly}
            dragId={dragId}
            setDragId={setDragId}
            move={move}
            changeWidget={changeWidget}
            dropAtEnd={dropAtEnd}
          />
        </div>
      ) : (
        <ResizableSplit
          storageKey={`adaptive-dashboard:${dashboardId}`}
          defaultRatio={layout.splitRatio}
          ratio={layout.splitRatio}
          onRatioCommit={(ratio) => commit({ ...layout, splitRatio: ratio }, `Dashboard columns resized to ${Math.round(ratio * 100)} and ${Math.round((1 - ratio) * 100)} percent.`)}
          left={
            <DashboardZoneColumn
              zone="primary"
              widgets={primary}
              layout={layout}
              content={content}
              definitions={definitionById}
              editMode={editMode && !readOnly}
              dragId={dragId}
              setDragId={setDragId}
              move={move}
              changeWidget={changeWidget}
              dropAtEnd={dropAtEnd}
            />
          }
          right={
            <div className="space-y-3 lg:pl-5">
              <div className="flex justify-end">
                <button type="button" onClick={() => setFocusMode(true)} className="text-xs font-semibold text-neutral-500 hover:text-orange-700">
                  Focus on primary
                </button>
              </div>
              <DashboardZoneColumn
                zone="supporting"
                widgets={supporting}
                layout={layout}
                content={content}
                definitions={definitionById}
                editMode={editMode && !readOnly}
                dragId={dragId}
                setDragId={setDragId}
                move={move}
                changeWidget={changeWidget}
                dropAtEnd={dropAtEnd}
              />
            </div>
          }
        />
      )}

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <style>{`
        [data-dashboard-id] .i2l-dashboard-tile { transition: transform var(--i2l-motion-standard), opacity var(--i2l-motion-standard), box-shadow var(--i2l-motion-standard); }
        [data-dashboard-id] .i2l-dashboard-tile:hover { transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { [data-dashboard-id] .i2l-dashboard-tile { transition: none !important; transform: none !important; } }
      `}</style>
    </section>
  )
}

function DashboardZoneColumn({
  zone,
  widgets,
  layout,
  content,
  definitions,
  editMode,
  dragId,
  setDragId,
  move,
  changeWidget,
  dropAtEnd,
}: {
  zone: DashboardZone
  widgets: DashboardWidgetLayout[]
  layout: DashboardLayoutState
  content: Map<string, DashboardWidgetContent>
  definitions: Map<string, ReturnType<typeof getDashboardDefinition>['widgets'][number]>
  editMode: boolean
  dragId: string | null
  setDragId: (id: string | null) => void
  move: (id: string, zone: DashboardZone, index: number) => void
  changeWidget: (id: string, patch: Partial<Pick<DashboardWidgetLayout, 'size' | 'visible' | 'collapsed'>>, message: string) => void
  dropAtEnd: (zone: DashboardZone) => void
}) {
  return (
    <div
      className={[
        'min-h-24 space-y-[var(--i2l-dashboard-gap)] rounded-xl',
        editMode ? 'border border-dashed border-orange-300 bg-orange-50/30 p-2' : '',
      ].join(' ')}
      onDragOver={(event) => { if (editMode) event.preventDefault() }}
      onDrop={(event) => { event.preventDefault(); dropAtEnd(zone) }}
      aria-label={`${zone === 'primary' ? 'Primary' : 'Supporting'} dashboard column`}
    >
      {editMode && <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">{zone}</p>}
      {widgets.map((widget, index) => (
        <DashboardTile
          key={widget.id}
          widget={widget}
          definition={definitions.get(widget.id)}
          content={content.get(widget.id)}
          editMode={editMode}
          isDragging={dragId === widget.id}
          onDragStart={() => setDragId(widget.id)}
          onDrop={() => { if (dragId) move(dragId, zone, index); setDragId(null) }}
          onChange={changeWidget}
          onMove={(targetZone, targetIndex) => move(widget.id, targetZone, targetIndex)}
          layout={layout}
        />
      ))}
      {widgets.length === 0 && editMode && (
        <p className="rounded-lg border border-dashed border-orange-200 px-3 py-8 text-center text-xs text-orange-700">Drop a tile here.</p>
      )}
    </div>
  )
}

function DashboardTile({
  widget,
  definition,
  content,
  editMode,
  isDragging,
  onDragStart,
  onDrop,
  onChange,
  onMove,
  layout,
}: {
  widget: DashboardWidgetLayout
  definition?: ReturnType<typeof getDashboardDefinition>['widgets'][number]
  content?: DashboardWidgetContent
  editMode: boolean
  isDragging: boolean
  onDragStart: () => void
  onDrop: () => void
  onChange: (id: string, patch: Partial<Pick<DashboardWidgetLayout, 'size' | 'visible' | 'collapsed'>>, message: string) => void
  onMove: (zone: DashboardZone, targetIndex: number) => void
  layout: DashboardLayoutState
}) {
  if (!definition || !content) return null
  const peers = layout.widgets.filter((item) => item.zone === widget.zone && item.size !== 'wide').sort((a, b) => a.order - b.order)
  const index = peers.findIndex((item) => item.id === widget.id)

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editMode) return
    if (event.key === 'ArrowUp') { event.preventDefault(); onMove(widget.zone, nextIndex(layout, widget, -1)) }
    if (event.key === 'ArrowDown') { event.preventDefault(); onMove(widget.zone, nextIndex(layout, widget, 1)) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); onMove('primary', 0) }
    if (event.key === 'ArrowRight') { event.preventDefault(); onMove('supporting', 0) }
  }

  return (
    <article
      draggable={editMode}
      onDragStart={onDragStart}
      onDragOver={(event) => { if (editMode) event.preventDefault() }}
      onDrop={(event) => { event.preventDefault(); onDrop() }}
      className={[
        'i2l-dashboard-tile overflow-hidden border bg-white',
        editMode ? 'border-orange-300 ring-1 ring-orange-100' : 'border-neutral-200',
        isDragging ? 'opacity-40' : '',
        widget.size === 'compact' ? 'text-sm' : '',
      ].join(' ')}
      style={{ borderRadius: 'var(--i2l-radius-card)', boxShadow: 'var(--i2l-shadow-card)' }}
      data-widget-id={widget.id}
    >
      <header className={['flex items-center gap-2 border-b border-neutral-100', widget.size === 'compact' ? 'px-3 py-2' : 'px-4 py-3'].join(' ')}>
        {editMode && (
          <button
            type="button"
            onKeyDown={onHandleKeyDown}
            className="inline-flex min-h-9 min-w-9 cursor-grab items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
            aria-label={`Move ${definition.title}. Use arrow keys or drag.`}
            title="Drag, or use arrow keys to move"
          >
            ⠿
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(widget.id, { collapsed: !widget.collapsed }, `${definition.title} ${widget.collapsed ? 'expanded' : 'collapsed'}.`)}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!widget.collapsed}
        >
          <span className={`text-neutral-400 transition-transform ${widget.collapsed ? '-rotate-90' : ''}`} aria-hidden>⌄</span>
          <span className="truncate font-semibold text-neutral-900">{definition.title}</span>
        </button>
        {content.actions && <div className="shrink-0">{content.actions}</div>}
      </header>

      {editMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-orange-100 bg-orange-50/60 px-3 py-2">
          <label className="text-[11px] font-semibold text-neutral-600">
            Size{' '}
            <select
              value={widget.size}
              onChange={(event) => onChange(widget.id, { size: event.target.value as DashboardTileSize }, `${definition.title} changed to ${event.target.value} size.`)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
            >
              {definition.allowedSizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => onMove(widget.zone, Math.max(0, index - 1))} className={buttonClass()} aria-label={`Move ${definition.title} up`}>↑</button>
          <button type="button" onClick={() => onMove(widget.zone, index + 1)} className={buttonClass()} aria-label={`Move ${definition.title} down`}>↓</button>
          <button
            type="button"
            onClick={() => onMove(widget.zone === 'primary' ? 'supporting' : 'primary', 0)}
            className={buttonClass()}
          >
            Move to {widget.zone === 'primary' ? 'supporting' : 'primary'}
          </button>
          {!definition.required && (
            <button type="button" onClick={() => onChange(widget.id, { visible: false }, `${definition.title} hidden.`)} className={`${buttonClass()} ml-auto`}>
              Hide
            </button>
          )}
          {definition.required && <span className="ml-auto text-[11px] font-medium text-neutral-500">Required</span>}
        </div>
      )}

      {!widget.collapsed && (
        <div className={widget.size === 'compact' ? 'p-3' : 'p-4'}>
          {content.content}
        </div>
      )}
    </article>
  )
}
