/**
 * lib/member-onboarding-template.ts
 *
 * The default onboarding checklist that is seeded automatically when a new
 * member is confirmed. Each task has a default owner (a communications-team
 * member) identified by name; the owner's profile id is resolved at confirm
 * time so the tasks land on the right person's personal dashboard.
 *
 * Owners are matched leniently (case-insensitive, whitespace-collapsed) against
 * `profiles.name`. If an owner cannot be resolved (renamed / not a platform user
 * yet) the task is still created with no owner, so the team can assign it
 * manually — seeding must never fail just because a default owner is missing.
 */

export type OnboardingTaskTemplate = {
  title: string
  /** Default owner, matched against profiles.name (case-insensitive). */
  ownerName: string
}

export const DEFAULT_ONBOARDING_TASKS: OnboardingTaskTemplate[] = [
  { title: 'Send template for invitation', ownerName: 'Ieva Kovalevskyte' },
  { title: 'Add to MS', ownerName: 'Guido Schouw' },
  { title: 'Add to WordPress', ownerName: 'Ieva Kovalevskyte' },
  { title: 'Add to WhatsApp', ownerName: 'Peter Kapitein' },
]

/** Normalizes a display name for tolerant matching (case + whitespace). */
export function normalizeOwnerName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type OnboardingSeedRow = {
  onboarding_id: string
  title: string
  assignee_id: string | null
  status: 'not_started'
  position: number
  created_by: string
}

/**
 * Pure computation of the default checklist rows to insert for a confirmed
 * member. Resolves each template task's owner by name against `profiles`
 * (unresolved → null), skips any title already present, and continues the
 * `position` sequence after the existing items. Kept side-effect-free so the
 * owner-resolution / de-duplication / ordering rules are unit-testable.
 */
export function buildOnboardingSeedRows(params: {
  onboardingId: string
  actorId: string
  profiles: Array<{ id: string; name: string | null }>
  existing: Array<{ title: string; position: number | null }>
}): OnboardingSeedRow[] {
  const { onboardingId, actorId, profiles, existing } = params

  const idByName = new Map<string, string>()
  for (const p of profiles) {
    const key = normalizeOwnerName(p.name)
    if (key && !idByName.has(key)) idByName.set(key, p.id)
  }

  const existingTitles = new Set(existing.map((t) => t.title.trim().toLowerCase()))
  let nextPosition = existing.reduce((max, t) => Math.max(max, (t.position ?? 0) + 1), 0)

  return DEFAULT_ONBOARDING_TASKS.filter(
    (t) => !existingTitles.has(t.title.trim().toLowerCase())
  ).map((t) => ({
    onboarding_id: onboardingId,
    title: t.title,
    assignee_id: idByName.get(normalizeOwnerName(t.ownerName)) ?? null,
    status: 'not_started' as const,
    position: nextPosition++,
    created_by: actorId,
  }))
}
