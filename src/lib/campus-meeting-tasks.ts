/**
 * lib/campus-meeting-tasks.ts
 *
 * The standard checklist of work that happens for every monthly Campus
 * meeting. Seeded as `comms_tasks` (tied to the campus session) when a
 * meeting is created, so each item has an owner, a status, and shows up on
 * the owner's personal dashboard. Owners can be reassigned afterwards.
 *
 * Each template task carries a default owner *name*; at seed time the name is
 * resolved to a platform profile id (falling back to the meeting's creator when
 * no matching profile exists).
 */

export type CampusMeetingTaskTemplate = {
  title: string
  /** Default owner, matched against `profiles.name` (case-insensitive) at seed time. */
  defaultOwnerName: string | null
}

export const CAMPUS_MEETING_TASK_TEMPLATE: readonly CampusMeetingTaskTemplate[] = [
  { title: 'Identify speaker', defaultOwnerName: 'Peter Kapitein' },
  { title: 'Prepare meeting', defaultOwnerName: 'Peter Kapitein' },
  { title: 'Receive bio + picture', defaultOwnerName: 'Peter Kapitein' },
  { title: 'Recording on WordPress', defaultOwnerName: 'Peter Kapitein' },
  { title: 'Transcript on platform', defaultOwnerName: 'Atefeh Sadeghi' },
  { title: 'Upload to YouTube', defaultOwnerName: 'Atefeh Sadeghi' },
  { title: 'Upload to WhatsApp', defaultOwnerName: 'Atefeh Sadeghi' },
]

/** Distinct default owner names referenced by the template (for batch lookup). */
export const CAMPUS_MEETING_DEFAULT_OWNERS: readonly string[] = Array.from(
  new Set(
    CAMPUS_MEETING_TASK_TEMPLATE.map((task) => task.defaultOwnerName).filter(
      (name): name is string => Boolean(name)
    )
  )
)
