/**
 * Fallback data for pages when Supabase returns empty results.
 * All DEMO_* arrays are empty — pages show real DB data or empty state.
 * Only the stage-vocabulary utilities contain logic/metadata.
 */

// ─── Canonical 5-stage vocabulary ────────────────────────────────────────────

export type InitiativeStage = 'idea' | 'planning' | 'execution' | 'public' | 'completed'

export function normalizeStage(phase: string | null | undefined): InitiativeStage {
  if (!phase) return 'planning'
  const p = phase.toLowerCase()
  if (p === 'idea') return 'idea'
  if (p === 'planning') return 'planning'
  if (p === 'research' || p === 'execution') return 'execution'
  if (p === 'public') return 'public'
  if (p === 'completed') return 'completed'
  return 'planning'
}

export const STAGE_META: Record<InitiativeStage, { label: string; color: string; description: string }> = {
  idea:      { label: 'Idea',      color: 'bg-violet-100 text-violet-700',   description: 'Concept stage — gathering support and defining scope' },
  planning:  { label: 'Planning',  color: 'bg-blue-100 text-blue-700',       description: 'Active planning — team forming, strategy being defined' },
  execution: { label: 'Execution', color: 'bg-orange-100 text-orange-700',   description: 'In progress — work is underway, milestones being achieved' },
  public:    { label: 'Public',    color: 'bg-emerald-100 text-emerald-700', description: 'Publicly active — results being shared with the community' },
  completed: { label: 'Completed', color: 'bg-neutral-200 text-neutral-600', description: 'Completed — objectives achieved, outcomes published' },
}

export const STAGE_ORDER: InitiativeStage[] = ['idea', 'planning', 'execution', 'public', 'completed']

// ─── Fallback arrays (all empty — real data comes from Supabase) ─────────────

export const DEMO_INITIATIVE_IDS: Record<string, string> = {}
export const DEMO_INITIATIVES:       never[] = []
export const DEMO_TASKS:             never[] = []
export const DEMO_NOTIFICATIONS:     never[] = []
export const DEMO_TEAM_MEMBERS_RICH: never[] = []
export const DEMO_EMAIL_THREADS:     never[] = []
export const DEMO_TEAM_CHAT:         never[] = []
export const DEMO_PARTNERS:          never[] = []
export const DEMO_RESOURCES:         never[] = []
export const DEMO_MILESTONES_RICH:   never[] = []
export const DEMO_EVIDENCE_RICH:     never[] = []
export const DEMO_NEWSFEED:          never[] = []
export const DEMO_BOARD_ACTIVITY:    never[] = []
export const DEMO_NETWORK_INTERNAL:  never[] = []
export const DEMO_NETWORK_EXTERNAL:  never[] = []
