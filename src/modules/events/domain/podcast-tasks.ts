/**
 * modules/events/domain/podcast-tasks.ts
 *
 * The standard checklist of work that happens for every podcast episode.
 * Seeded as `comms_tasks` (tied to the event) when the podcast workspace is
 * first opened, so each item has an owner, a status, and a deadline, and shows
 * up on the owner's personal dashboard. Owners can be reassigned afterwards and
 * tasks can be freely added, edited, or deleted.
 *
 * The template mirrors the three phases of producing an episode (setup, run,
 * follow-up) but the podcast workspace renders them as one flat, editable list
 * rather than as separate tabs.
 */

export type PodcastTaskTemplate = {
  title: string
  /** Production phase this task belongs to — used only to order the seed. */
  phase: 'setup' | 'run' | 'follow_up'
}

export const PODCAST_TASK_TEMPLATE: readonly PodcastTaskTemplate[] = [
  // Setup
  { title: 'Brief and goals agreed', phase: 'setup' },
  { title: 'Guest confirmed', phase: 'setup' },
  { title: 'Release/consent handled', phase: 'setup' },
  { title: 'Equipment and platform checked', phase: 'setup' },
  // Run
  { title: 'Recording completed', phase: 'run' },
  { title: 'Backup stored', phase: 'run' },
  { title: 'Edit completed', phase: 'run' },
  { title: 'Transcript prepared', phase: 'run' },
  // Follow-up
  { title: 'Show notes and metadata ready', phase: 'follow_up' },
  { title: 'Published or scheduled', phase: 'follow_up' },
  { title: 'Guest and audience follow-up done', phase: 'follow_up' },
]
