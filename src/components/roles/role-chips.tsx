'use client'

import { useMemo } from 'react'
import { useRoleLayers } from './role-layers-context'

function chipClass(tone: 'neutral' | 'orange' | 'ink') {
  return [
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none',
    tone === 'ink'
      ? 'border-neutral-800 bg-neutral-950 text-white'
      : tone === 'orange'
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : 'border-neutral-200 bg-white text-neutral-700',
  ].join(' ')
}

export function RoleChips({
  compact = false,
  workspaceLabel = 'Platform',
}: {
  compact?: boolean
  workspaceLabel?: string
}) {
  const { platformRole, congressRoles } = useRoleLayers()

  const congressLabel = useMemo(() => {
    if (!congressRoles || congressRoles.length === 0) return '—'
    if (compact && congressRoles.length > 1) return `${congressRoles[0]} +${congressRoles.length - 1}`
    return congressRoles.join(', ')
  }, [congressRoles, compact])

  return (
    <div className="hidden lg:flex items-center gap-2" aria-label="Role layers">
      <span className={chipClass(workspaceLabel === 'Communications' ? 'ink' : 'neutral')} title="Your active workspace type">
        Workspace: <span className="ml-1 font-bold">{workspaceLabel}</span>
      </span>
      <span className={chipClass('neutral')} title="Your global platform permission layer">
        Platform role: <span className="ml-1 font-bold">{platformRole}</span>
      </span>
      <span className={chipClass('orange')} title="Your congress responsibility layer">
        Congress role(s): <span className="ml-1 font-bold">{congressLabel}</span>
      </span>
    </div>
  )
}
