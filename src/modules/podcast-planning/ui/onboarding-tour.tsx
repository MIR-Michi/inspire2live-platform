'use client'

/**
 * podcast-planning/ui/onboarding-tour.tsx — "How it works", watchable in-app.
 *
 * A self-playing walkthrough of the Podcast space that behaves like an explainer
 * video: twenty scenes in six chapters (~4 minutes), story-style progress bars,
 * play/pause, scene skipping and a chapter rail to jump straight to a subject.
 * The script lives in `onboarding-tour-scenes.tsx`; it explains the *reasoning*
 * behind the workflow, not only where the buttons are.
 *
 * It is assembled from the planner's own icons and card shapes, so what it
 * teaches is literally what the user will see — and when the UI changes, this
 * changes with it (no mp4 to re-record).
 *
 * Each scene is narrated aloud through the browser's built-in speech synthesis
 * at a deliberately slow, level rate (no audio assets, nothing to re-record):
 * a scene that finishes visually holds until its sentence has been spoken,
 * pausing the tour pauses the voice, and a speaker button mutes it. Where
 * speech synthesis is unavailable the tour plays silently.
 *
 * The player is resizable (three widths, remembered per browser) and driveable
 * from the keyboard: space plays and pauses, the arrows step between scenes,
 * escape closes.
 *
 * Opened from a button in the space header; never auto-plays.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CHAPTER_START,
  CHAPTERS,
  SCENES,
  TOTAL_MS,
} from '@/modules/podcast-planning/ui/onboarding-tour-scenes'

// ─── Playback ─────────────────────────────────────────────────────────────────

const TICK_MS = 100

/** Slower than default and slightly under natural pitch: explanatory, unhurried. */
const SPEECH_RATE = 0.86
const SPEECH_PITCH = 0.95
/** A beat of silence before a scene starts speaking, so it never barges in. */
const SPEECH_LEAD_MS = 450

type PlayerState = { scene: number; elapsed: number; playing: boolean; spoken: boolean }

/**
 * One tick of playback: advance within the scene, roll over, or stop at the end.
 * With narration on, a visually finished scene holds (bar full) until its
 * sentence has been spoken, so the voice is never cut off mid-word.
 */
function advance(prev: PlayerState, waitForSpeech: boolean): PlayerState {
  if (!prev.playing) return prev
  const duration = SCENES[prev.scene].duration
  const elapsed = Math.min(prev.elapsed + TICK_MS, duration)
  if (elapsed < duration) return { ...prev, elapsed }
  if (waitForSpeech && !prev.spoken) return { ...prev, elapsed }
  if (prev.scene < SCENES.length - 1)
    return { scene: prev.scene + 1, elapsed: 0, playing: true, spoken: false }
  return { ...prev, elapsed, playing: false }
}

/** Calm, unhurried English voices, best first. Falls back to whatever exists. */
const CALM_VOICES = [/serena/i, /libby/i, /sonia/i, /daniel/i, /google uk english/i, /samantha/i]

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
  if (english.length === 0) return null
  const british = english.filter((voice) => voice.lang.toLowerCase().startsWith('en-gb'))
  const pool = british.length > 0 ? british : english
  for (const pattern of CALM_VOICES) {
    const match = pool.find((voice) => pattern.test(voice.name))
    if (match) return match
  }
  return pool[0] ?? null
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// ─── Size ─────────────────────────────────────────────────────────────────────

const SIZES = ['compact', 'regular', 'large'] as const
type Size = (typeof SIZES)[number]

const SIZE_STYLE: Record<Size, { shell: string; stage: string; scale: string }> = {
  compact: { shell: 'max-w-xl', stage: 'h-56 sm:h-64', scale: 'scale-90' },
  regular: { shell: 'max-w-3xl', stage: 'h-72 sm:h-80', scale: 'scale-100' },
  large: { shell: 'max-w-5xl', stage: 'h-80 sm:h-[28rem]', scale: 'scale-110 sm:scale-125' },
}

const SIZE_KEY = 'i2l.podcast-tour.size'

function storedSize(): Size {
  if (typeof window === 'undefined') return 'regular'
  try {
    const saved = window.localStorage.getItem(SIZE_KEY)
    return (SIZES as readonly string[]).includes(saved ?? '') ? (saved as Size) : 'regular'
  } catch {
    return 'regular'
  }
}

// ─── The player ───────────────────────────────────────────────────────────────

function TourPlayer({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<PlayerState>({
    scene: 0,
    elapsed: 0,
    playing: true,
    spoken: false,
  })
  // The player only mounts after a click, so these are plain browser reads.
  const [voiceSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  )
  const [voiceOn, setVoiceOn] = useState(true)
  const [size, setSize] = useState<Size>(storedSize)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Chrome garbage-collects utterances it no longer references, which silences
  // `onend`; holding the current one in a ref keeps it alive until it finishes.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const { scene, elapsed, playing } = state
  const current = SCENES[scene]
  const narrating = voiceSupported && voiceOn
  const atEnd =
    scene === SCENES.length - 1 && elapsed >= current.duration && (!narrating || state.spoken)

  const goTo = useCallback((index: number) => {
    setState((prev) => {
      const next = Math.max(0, Math.min(index, SCENES.length - 1))
      return {
        scene: next,
        elapsed: 0,
        playing: true,
        // Replaying the same scene reruns the visuals without re-speaking, so
        // keep its spoken flag — otherwise it would wait forever on a voice
        // that already finished.
        spoken: next === prev.scene ? prev.spoken : false,
      }
    })
  }, [])

  const toggle = useCallback(() => {
    setState((prev) =>
      prev.scene === SCENES.length - 1 && prev.elapsed >= SCENES[prev.scene].duration
        ? { scene: 0, elapsed: 0, playing: true, spoken: false }
        : { ...prev, playing: !prev.playing }
    )
  }, [])

  const resize = useCallback((step: number) => {
    setSize((prev) => {
      const index = SIZES.indexOf(prev) + step
      return SIZES[Math.max(0, Math.min(index, SIZES.length - 1))]
    })
  }, [])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIZE_KEY, size)
    } catch {
      // A browser refusing storage should not break playback.
    }
  }, [size])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') return onClose()
      if (event.key === 'ArrowRight') return goTo(state.scene + 1)
      if (event.key === 'ArrowLeft') return goTo(state.scene - 1)
      // Space on a focused button already clicks it; don't toggle twice.
      if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goTo, toggle, state.scene])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setState((prev) => advance(prev, narrating)), TICK_MS)
    return () => clearInterval(timer)
  }, [playing, narrating])

  // Speak the current scene; re-runs when the scene changes or voice is toggled.
  useEffect(() => {
    if (!narrating) return
    const synth = window.speechSynthesis
    synth.cancel()
    const markSpoken = () => setState((prev) => ({ ...prev, spoken: true }))
    const lead = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(SCENES[scene].narration)
      utterance.lang = 'en-GB'
      utterance.rate = SPEECH_RATE
      utterance.pitch = SPEECH_PITCH
      // Read late: Chrome populates the voice list asynchronously.
      const voice = pickVoice(synth.getVoices())
      if (voice) utterance.voice = voice
      utterance.onend = markSpoken
      utterance.onerror = markSpoken
      utteranceRef.current = utterance
      synth.speak(utterance)
    }, SPEECH_LEAD_MS)
    return () => {
      clearTimeout(lead)
      const utterance = utteranceRef.current
      if (utterance) {
        utterance.onend = null
        utterance.onerror = null
      }
      synth.cancel()
    }
  }, [scene, narrating])

  // Pausing the tour pauses the voice mid-sentence, and play resumes it.
  useEffect(() => {
    if (!narrating) return
    if (playing) window.speechSynthesis.resume()
    else window.speechSynthesis.pause()
  }, [playing, narrating])

  // Chrome stops speaking after ~15 seconds unless nudged; harmless elsewhere.
  useEffect(() => {
    if (!narrating || !playing) return
    const keepAlive = setInterval(() => window.speechSynthesis.resume(), 8000)
    return () => clearInterval(keepAlive)
  }, [narrating, playing])

  const CurrentView = current.View
  const style = SIZE_STYLE[size]
  const chapterScenes = SCENES.map((item, index) => ({ item, index })).filter(
    ({ item }) => item.chapter === current.chapter
  )
  const overall = SCENES.slice(0, scene).reduce((sum, item) => sum + item.duration, 0) + elapsed

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
        className={`w-full ${style.shell} overflow-hidden rounded-2xl bg-white shadow-2xl outline-none`}
      >
        {/* Title bar: what this is, how long it takes, how big it should be. */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">How the Podcast space works</h2>
            <span className="text-xs font-medium tabular-nums text-neutral-400">
              {clock(overall)} / {clock(TOTAL_MS)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Smaller"
              onClick={() => resize(-1)}
              disabled={size === SIZES[0]}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                <path d="M9 3v6H3M21 15h-6v6" />
                <path d="m3 21 6-6M21 3l-6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Larger"
              onClick={() => resize(1)}
              disabled={size === SIZES[SIZES.length - 1]}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                <path d="M15 3h6v6M9 21H3v-6" />
                <path d="M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chapters: jump straight to a subject. */}
        <div className="flex flex-wrap gap-1 px-4 pt-3">
          {CHAPTERS.map((chapter) => {
            const active = chapter.id === current.chapter
            const Icon = chapter.Icon
            return (
              <button
                key={chapter.id}
                type="button"
                aria-current={active}
                onClick={() => goTo(CHAPTER_START[chapter.id])}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-neutral-950 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {chapter.label}
              </button>
            )
          })}
        </div>

        {/* Story-style progress: one bar per scene in this chapter, click to jump. */}
        <div className="flex gap-1 px-4 pt-2">
          {chapterScenes.map(({ item, index }) => {
            const fill =
              index < scene
                ? 100
                : index > scene
                  ? 0
                  : Math.min((elapsed / item.duration) * 100, 100)
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
        <div className={`relative ${style.stage}`}>
          <div key={current.id} className={`h-full origin-center ${style.scale}`}>
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
        <div
          key={`caption-${current.id}`}
          aria-live="polite"
          className="animate-fade-up px-6 pb-4 text-center"
        >
          <h3 className="text-base font-semibold text-neutral-900">{current.title}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">{current.caption}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
          <span className="w-16 text-xs font-medium tabular-nums text-neutral-400">
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
              onClick={toggle}
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
            {voiceSupported && (
              <button
                type="button"
                aria-label={voiceOn ? 'Mute narration' : 'Unmute narration'}
                aria-pressed={voiceOn}
                onClick={() => setVoiceOn((on) => !on)}
                className={`rounded-lg p-2 hover:bg-neutral-100 ${voiceOn ? 'text-neutral-600' : 'text-neutral-300'}`}
              >
                {voiceOn ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                    <path d="M11 5 6 9H2v6h4l5 4z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                    <path d="M11 5 6 9H2v6h4l5 4z" />
                    <path d="m16 9 6 6" />
                    <path d="m22 9-6 6" />
                  </svg>
                )}
              </button>
            )}
          </div>
          <span className="w-16 text-right text-[11px] font-medium text-neutral-400">
            space · ← →
          </span>
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
