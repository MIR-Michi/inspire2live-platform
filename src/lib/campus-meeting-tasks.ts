/**
 * lib/campus-meeting-tasks.ts
 *
 * The standard checklist of work that happens for every monthly Campus
 * meeting. Seeded as `comms_tasks` (tied to the campus session) when a
 * meeting is created, so each item has an owner, a status, and shows up on
 * the owner's personal dashboard. Owners can be reassigned afterwards.
 */

export const CAMPUS_MEETING_TASK_TEMPLATE: readonly string[] = [
  'Identify speaker and topic',
  'Receive bio and picture',
  'Do a prep meeting',
  'Record meeting',
  'Publish recording on YouTube',
  'Publish recording on WordPress',
  'Publish recording on WhatsApp',
]
