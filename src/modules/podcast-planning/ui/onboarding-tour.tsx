'use client'

/**
 * podcast-planning/ui/onboarding-tour.tsx — "How it works", watchable in-app.
 *
 * A short self-playing walkthrough of the Podcast space that behaves like an
 * explainer video: seven scenes of ~7 seconds, story-style progress bars,
 * play/pause, and scene-to-scene skipping. It is built from the same icons and
 * shapes as the real screens, so what it teaches is literally what the user
 * will see — and when the UI changes, this changes with it (no mp4 to re-record).
 *
 * Opened from a button in the space header; never auto-plays.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconAsk,
  IconBoard,
  IconBooked,
  IconCheck,
  IconClock,
  IconPlanning,
  IconQuestion,
  IconRecorded,
  IconWishlist,
  InitialsAvatar,
  STAGE_ICONS,
} from '@/modules/podcast-planning/ui/icons'

// ─── The scenes ───────────────────────────────────────────────────────────────

/** A staggered entrance: fade-up with a delay, hidden until its turn. */
function Enter({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function ChipMock({ label, delay }: { label: string; delay: number }) {
  return (
    <Enter delay={delay}>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <IconCheck className="h-3 w-3" />
        {label}
      </span>
    </Enter>
  )
}

function SceneWelcome() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <Enter delay={200}>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 text-white">
          <IconRecorded className="h-8 w-8" />
        </span>
      </Enter>
      <div className="flex gap-2">
        <Enter delay={900}>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700">
            <IconRecorded className="h-4 w-4" />
            Episodes
          </span>
        </Enter>
        <Enter delay={1400}>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700">
            <IconBoard className="h-4 w-4" />
            Planning
          </span>
        </Enter>
      </div>
    </div>
  )
}

function SceneQuestion() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <Enter delay={200}>
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <IconQuestion className="h-4 w-4 shrink-0 text-neutral-400" />
            Why is a proven diagnostic still unreimbursed?
          </p>
        </div>
      </Enter>
      <div className="flex max-w-sm flex-wrap justify-center gap-1.5">
        <ChipMock label="Question" delay={1200} />
        <ChipMock label="Why now" delay={2000} />
        <ChipMock label="Action" delay={2800} />
        <ChipMock label="Link" delay={3600} />
        <ChipMock label="Format" delay={4400} />
      </div>
    </div>
  )
}

function SceneWishlist() {
  const people = ['Maria Santos', 'John Weber', 'Aisha Khan']
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-xs rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
          <IconWishlist className="h-3.5 w-3.5 text-neutral-400" />
          Wishlist
        </p>
        <ul className="space-y-2">
          {people.map((name, index) => (
            <li key={name}>
              <Enter delay={600 + index * 900}>
                <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                  <InitialsAvatar name={name} className="h-8 w-8 text-[11px]" />
                  <span className="text-sm font-semibold text-neutral-900">{name}</span>
                </div>
              </Enter>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SceneNextMove() {
  const steps = ['wishlist', 'research', 'ask', 'planning', 'booked', 'recorded'] as const
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <Enter delay={200}>
        <ol className="flex items-center">
          {steps.map((stage, index) => {
            const Icon = STAGE_ICONS[stage]
            const state = index < 1 ? 'done' : index === 1 ? 'active' : 'todo'
            return (
              <li key={stage} className="flex items-center">
                {index > 0 && (
                  <span className={`h-0.5 w-4 ${state === 'todo' ? 'bg-neutral-200' : 'bg-neutral-800'}`} />
                )}
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border',
                    state === 'active'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : state === 'done'
                        ? 'border-neutral-800 bg-white text-neutral-800'
                        : 'border-neutral-200 bg-white text-neutral-300',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </li>
            )
          })}
        </ol>
      </Enter>
      <Enter delay={1400}>
        <span className="flex animate-pulse items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">
          <IconAsk className="h-4 w-4" />
          Ask
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Enter>
    </div>
  )
}

function SceneWaiting() {
  return (
    <div className="flex h-full items-center justify-center gap-3 px-6">
      <Enter delay={200}>
        <div className="w-40 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
            <span className="flex items-center gap-1.5">
              <IconAsk className="h-3.5 w-3.5 text-amber-600" />
              Ask
            </span>
            <span className="font-medium text-neutral-500">3/6</span>
          </p>
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <InitialsAvatar name="Maria Santos" className="h-7 w-7 text-[10px]" />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                <IconClock className="h-3 w-3" />
                9d
              </span>
            </div>
          </div>
        </div>
      </Enter>
      <Enter delay={1400}>
        <div className="w-40 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
            <IconPlanning className="h-3.5 w-3.5 text-amber-600" />
            Planning
            <IconClock className="h-3 w-3 text-amber-600" />
          </p>
          <p className="py-3 text-center text-[11px] text-neutral-400">waiting on them</p>
        </div>
      </Enter>
    </div>
  )
}

function SceneNextUp() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
      <Enter delay={200}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Next up</p>
      </Enter>
      <div className="flex flex-wrap justify-center gap-2">
        <Enter delay={800}>
          <span className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
            <InitialsAvatar name="John Weber" className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-semibold text-neutral-800">John Weber</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Nudge due
            </span>
          </span>
        </Enter>
        <Enter delay={1800}>
          <span className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
            <InitialsAvatar name="Aisha Khan" className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-semibold text-neutral-800">Aisha Khan</span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              No reply
            </span>
          </span>
        </Enter>
      </div>
    </div>
  )
}

function SceneFinish() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <div className="flex items-center gap-2">
        <Enter delay={200}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-white text-neutral-800">
            <IconBooked className="h-5 w-5" />
          </span>
        </Enter>
        <Enter delay={800}>
          <span className="h-0.5 w-6 bg-neutral-800" />
        </Enter>
        <Enter delay={1000}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconRecorded className="h-5 w-5" />
          </span>
        </Enter>
      </div>
      <Enter delay={2000}>
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <InitialsAvatar name="Maria Santos" className="h-9 w-9 text-xs" />
          <div>
            <p className="text-sm font-semibold text-neutral-900">New episode</p>
            <p className="text-xs text-neutral-500">on the content calendar</p>
          </div>
        </div>
      </Enter>
    </div>
  )
}

type Scene = {
  id: string
  title: string
  caption: string
  duration: number
  View: () => React.JSX.Element
}

const SCENES: Scene[] = [
  {
    id: 'welcome',
    title: 'The Podcast space',
    caption: 'Two rooms: the episodes you make, and the planning that books them.',
    duration: 6000,
    View: SceneWelcome,
  },
  {
    id: 'question',
    title: 'Start with a question',
    caption: 'Five checks make it ready for names — green means done.',
    duration: 7500,
    View: SceneQuestion,
  },
  {
    id: 'wishlist',
    title: 'List who could answer it',
    caption: 'Add as many people as you like — research is unlimited.',
    duration: 6500,
    View: SceneWishlist,
  },
  {
    id: 'next-move',
    title: 'Follow the one next move',
    caption: 'Every card shows a single button for its next step. If it is blocked, it says why.',
    duration: 7000,
    View: SceneNextMove,
  },
  {
    id: 'waiting',
    title: 'Amber means waiting',
    caption: 'Ask and Planning wait on somebody else. Six open asks is the ceiling.',
    duration: 7000,
    View: SceneWaiting,
  },
  {
    id: 'next-up',
    title: '“Next up” finds your work',
    caption: 'Cards that need a decision surface at the top — no scanning columns.',
    duration: 7000,
    View: SceneNextUp,
  },
  {
    id: 'finish',
    title: 'Booked, recorded, published',
    caption: 'A recorded card hands over to the content calendar. Start with a question.',
    duration: 7500,
    View: SceneFinish,
  },
]

const TICK_MS = 100

// ─── The player ───────────────────────────────────────────────────────────────

type PlayerState = { scene: number; elapsed: number; playing: boolean }

/** One tick of playback: advance within the scene, roll over, or stop at the end. */
function advance(prev: PlayerState): PlayerState {
  if (!prev.playing) return prev
  const duration = SCENES[prev.scene].duration
  const elapsed = prev.elapsed + TICK_MS
  if (elapsed < duration) return { ...prev, elapsed }
  if (prev.scene < SCENES.length - 1) return { scene: prev.scene + 1, elapsed: 0, playing: true }
  return { ...prev, elapsed: duration, playing: false }
}

function TourPlayer({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<PlayerState>({ scene: 0, elapsed: 0, playing: true })
  const dialogRef = useRef<HTMLDivElement>(null)

  const { scene, elapsed, playing } = state
  const current = SCENES[scene]
  const atEnd = scene === SCENES.length - 1 && elapsed >= current.duration

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setState(advance), TICK_MS)
    return () => clearInterval(timer)
  }, [playing])

  const goTo = useCallback((index: number) => {
    setState({
      scene: Math.max(0, Math.min(index, SCENES.length - 1)),
      elapsed: 0,
      playing: true,
    })
  }, [])

  const CurrentView = current.View

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="How the Podcast space works"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        {/* Story-style progress: one bar per scene, click to jump. */}
        <div className="flex gap-1 px-4 pt-3">
          {SCENES.map((item, index) => {
            const fill =
              index < scene ? 100 : index > scene ? 0 : Math.min((elapsed / item.duration) * 100, 100)
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                onClick={() => goTo(index)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
              >
                <span
                  className="block h-full rounded-full bg-neutral-800 transition-[width] duration-100 ease-linear"
                  style={{ width: `${fill}%` }}
                />
              </button>
            )
          })}
        </div>

        {/* Stage */}
        <div className="relative h-64 sm:h-72">
          <div key={current.id} className="h-full">
            <CurrentView />
          </div>

          {atEnd && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <button
                type="button"
                onClick={() => goTo(0)}
                className="flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                  <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Watch again
              </button>
            </div>
          )}
        </div>

        {/* Caption */}
        <div key={`caption-${current.id}`} className="animate-fade-up px-6 pb-4 text-center">
          <h2 className="text-base font-semibold text-neutral-900">{current.title}</h2>
          <p className="mt-0.5 text-sm text-neutral-500">{current.caption}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
          <span className="w-14 text-xs font-medium text-neutral-400">
            {scene + 1}/{SCENES.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => goTo(scene - 1)}
              disabled={scene === 0}
              className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path d="M6 5h2v14H6zM20 5v14l-10-7z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() =>
                atEnd ? goTo(0) : setState((prev) => ({ ...prev, playing: !prev.playing }))
              }
              className="rounded-lg bg-neutral-950 p-2.5 text-white hover:bg-neutral-800"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => goTo(scene + 1)}
              disabled={scene === SCENES.length - 1}
              className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path d="M16 5h2v14h-2zM4 5v14l10-7z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-14 text-right text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** The button that lives in the space header, and the player it opens. */
export function PodcastOnboardingTour() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5 text-orange-600">
          <path d="M8 5v14l11-7z" />
        </svg>
        How it works
      </button>
      {open && <TourPlayer onClose={() => setOpen(false)} />}
    </>
  )
}
