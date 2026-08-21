'use client'

/**
 * podcast-planning/ui/onboarding-tour-scenes.tsx — the script the tour plays.
 *
 * Twenty-seven scenes in seven chapters, following **one worked example** (the
 * unreimbursed-diagnostic question in `onboarding-tour-fixture.ts`) from a blank
 * Questions screen to a recording handed to the calendar.
 *
 * Most scenes put the **real screens** on stage — the Questions screen, the
 * Board, a candidate drawer, the route explorer, the People directory and the
 * Radar review, rendered server-side in `onboarding-tour-screens.tsx` and
 * referenced here by `screen` — with a `focus` that zooms into the part being
 * talked about. The rest are schematic, and only where there is nothing to point
 * at: the reason a question outlives a no, the shape of the network, the rule
 * that keeps Radar grounded, the six-ask ceiling.
 *
 * The rationale spoken here is the reasoning recorded in
 * `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` (§1 why it exists · §2 question
 * before names · §3 stages, gates and the one limit · §5 discovery · §7 routes ·
 * §10 the score) — when that thinking changes, change it here too.
 *
 * Scene length is derived from the narration (see `narrationMs`) so the progress
 * bar tracks the voice instead of racing ahead of it.
 *
 * **The narration is spoken, so it is written to be spoken** — contractions,
 * one idea per sentence, and the reason stated before the mechanism. It is not
 * the caption read aloud, and it is not prose: an em-dashed subclause that reads
 * well on the page arrives as a run-on when a synthesiser says it. Jargon is the
 * other trap. "Booking is the hard part" tested as meaningless to somebody who
 * had not already worked on a podcast, and is now "getting a yes".
 */

import {
  IconArrowRight,
  IconAsk,
  IconBoard,
  IconBooked,
  IconCheck,
  IconClose,
  IconHandshake,
  IconOverride,
  IconPeople,
  IconPlanning,
  IconQuestion,
  IconRecorded,
  IconStar,
  InitialsAvatar,
} from '@/modules/podcast-planning/ui/icons'

// ─── Shared scene furniture ───────────────────────────────────────────────────

/** A staggered entrance: fade-up with a delay, hidden until its turn. */
function Enter({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/** The stage's standard frame: centred, breathing room, nothing else. */
function Stage({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-4 px-6">{children}</div>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{children}</p>
  )
}

// ─── Chapter 1 · Why this space exists ────────────────────────────────────────

function SceneWelcome() {
  return (
    <Stage>
      <Enter delay={200}>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 text-white">
          <IconRecorded className="h-8 w-8" />
        </span>
      </Enter>
      <div className="flex gap-2">
        <Enter delay={1200}>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700">
            <IconRecorded className="h-4 w-4" />
            Episodes
          </span>
        </Enter>
        <Enter delay={1900}>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700">
            <IconBoard className="h-4 w-4" />
            Planning
          </span>
        </Enter>
      </div>
    </Stage>
  )
}

function SceneBottleneck() {
  // "Booking" was the label here and it did not survive contact with a viewer:
  // read cold, next to Recording and Publishing, it sounds like diary admin
  // rather than the work of persuading a stranger to come on.
  const steps = [
    { label: 'Question', hot: false },
    { label: 'Getting a yes', hot: true },
    { label: 'Recording', hot: false },
    { label: 'Publishing', hot: false },
  ]
  return (
    <Stage>
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-1.5">
            {index > 0 && <span className="h-0.5 w-4 bg-neutral-200" />}
            <Enter delay={200 + index * 600}>
              <span
                className={
                  step.hot
                    ? 'rounded-xl bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm'
                    : 'rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-400'
                }
              >
                {step.label}
              </span>
            </Enter>
          </div>
        ))}
      </div>
      <Enter delay={3200}>
        <p className="text-xs font-medium text-neutral-500">
          almost all the effort goes here, not into the edit
        </p>
      </Enter>
    </Stage>
  )
}

function SceneVisible() {
  return (
    <Stage>
      <div className="flex items-center gap-4">
        <Enter delay={200}>
          <div className="w-32 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-6 w-6 text-neutral-300">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
            <p className="mt-2 text-[11px] font-medium text-neutral-400">one head, one inbox</p>
          </div>
        </Enter>
        <Enter delay={1400}>
          <IconArrowRight className="h-5 w-5 text-neutral-400" />
        </Enter>
        <Enter delay={2000}>
          <div className="flex gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
            {[0, 1, 2].map((column) => (
              <div key={column} className="w-12 space-y-1 rounded-lg bg-neutral-50 p-1.5">
                <span className="block h-1.5 w-6 rounded-full bg-neutral-300" />
                <span className="block h-4 rounded bg-white shadow-sm" />
                {column < 2 && <span className="block h-4 rounded bg-white shadow-sm" />}
              </div>
            ))}
          </div>
        </Enter>
      </div>
      <Enter delay={2900}>
        <p className="text-xs font-medium text-neutral-500">visible, so it can be shared and learned from</p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 2 · It starts with a question ────────────────────────────────────

function SceneOutlives() {
  const people = ['Anna Bergmann', 'Ruben Oduya', 'Femke Aalders']
  return (
    <Stage>
      <Enter delay={200}>
        <Card className="w-full max-w-md">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <IconQuestion className="h-4 w-4 shrink-0 text-neutral-400" />
            Why is a proven diagnostic still unreimbursed?
          </p>
          <p className="mt-1 pl-6 text-[11px] font-medium text-emerald-700">still live</p>
        </Card>
      </Enter>
      <div className="flex gap-2">
        {people.map((name, index) => {
          const declined = index === 1
          return (
            <Enter key={name} delay={1200 + index * 600}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${declined ? 'border-neutral-200 bg-neutral-50 opacity-60' : 'border-neutral-200 bg-white shadow-sm'}`}
              >
                <InitialsAvatar name={name} className="h-7 w-7 text-[10px]" />
                {declined ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    <IconClose className="h-3 w-3" />
                    No
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-neutral-700">{name.split(' ')[0]}</span>
                )}
              </div>
            </Enter>
          )
        })}
      </div>
      <Enter delay={3400}>
        <p className="text-xs font-medium text-neutral-500">a refusal costs one card, never the question</p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 3 · Finding the people ───────────────────────────────────────────

/** Concentric reach: the warm rings first, the cold world last. */
function SceneNetworkFirst() {
  const rings = [
    { label: 'Everyone else', size: 'h-56 w-56', tone: 'border-dashed border-neutral-200 text-neutral-400' },
    { label: 'People they know', size: 'h-44 w-44', tone: 'border-neutral-200 text-neutral-500' },
    { label: 'Members & hubs', size: 'h-32 w-32', tone: 'border-neutral-300 text-neutral-600' },
    { label: 'Past guests', size: 'h-20 w-20', tone: 'border-neutral-900 text-neutral-900' },
  ]
  return (
    <Stage>
      <div className="relative flex h-56 w-56 items-center justify-center">
        {rings.map((ring, index) => (
          <div key={ring.label} className="absolute inset-0 flex items-center justify-center">
            <Enter delay={2400 - index * 700}>
              <div
                className={`flex ${ring.size} items-start justify-center rounded-full border-2 ${ring.tone}`}
              >
                <span className="mt-1.5 text-[10px] font-semibold">{ring.label}</span>
              </div>
            </Enter>
          </div>
        ))}
        <Enter delay={3000}>
          <IconPeople className="h-5 w-5 text-neutral-900" />
        </Enter>
      </div>
      <Enter delay={3600}>
        <p className="text-xs font-medium text-neutral-500">warm first — a cold approach is the last resort</p>
      </Enter>
    </Stage>
  )
}

/**
 * Where the facts come from, and what is left for the model to do (ADR-0016).
 * The struck-through name is the point of the scene, not decoration.
 */
function SceneGrounding() {
  return (
    <Stage>
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          {['OpenAlex', 'Europe PMC'].map((source, index) => (
            <Enter key={source} delay={200 + index * 500}>
              <span className="block rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 shadow-sm">
                {source}
              </span>
            </Enter>
          ))}
          <Enter delay={1200}>
            <p className="pt-0.5 text-[10px] font-medium text-neutral-400">open catalogues</p>
          </Enter>
        </div>
        <Enter delay={1500}>
          <IconArrowRight className="h-4 w-4 text-neutral-400" />
        </Enter>
        <Enter delay={1800}>
          <div className="w-28 rounded-xl border-2 border-neutral-900 bg-white px-2.5 py-2 text-center shadow-sm">
            <p className="text-[11px] font-bold text-neutral-900">the records</p>
            <p className="mt-0.5 text-[10px] leading-tight text-neutral-500">
              papers · authors · affiliations · dates
            </p>
          </div>
        </Enter>
        <Enter delay={2400}>
          <IconArrowRight className="h-4 w-4 text-neutral-400" />
        </Enter>
        <Enter delay={2700}>
          <div className="w-28 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-2.5 py-2 text-center">
            <p className="text-[11px] font-bold text-violet-800">the model</p>
            <p className="mt-0.5 text-[10px] leading-tight text-violet-700">
              groups and phrases — nothing else
            </p>
          </div>
        </Enter>
      </div>
      <Enter delay={3500}>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          {/* Deliberately not an InitialsAvatar: real initials here read as a
              real person, and this one is meant to be nobody. */}
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-neutral-300 text-[11px] font-bold text-neutral-300">
            ?
          </span>
          <span className="text-xs font-medium text-neutral-400 line-through">
            a name no record backs
          </span>
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white">
            dropped
          </span>
        </div>
      </Enter>
      <Enter delay={4300}>
        <p className="text-xs font-medium text-neutral-500">
          dropped before you see it — not flagged for you to judge
        </p>
      </Enter>
    </Stage>
  )
}

/** What accepting writes — and, more importantly, what it refuses to write. */
function SceneAccept() {
  const writes = ['A draft question', 'Unscored cards on the wishlist', 'People, each fact cited']
  const nevers = ['a score', 'a listener action', 'any stage past Wishlist']
  return (
    <Stage>
      <Enter delay={200}>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
          <IconCheck className="h-3.5 w-3.5" />
          Open the question with 2 names
        </span>
      </Enter>
      <div className="flex flex-wrap justify-center gap-1.5">
        {writes.map((item, index) => (
          <Enter key={item} delay={900 + index * 600}>
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm">
              <IconCheck className="h-3 w-3 text-emerald-600" />
              {item}
            </span>
          </Enter>
        ))}
      </div>
      <Enter delay={3000}>
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">
            never
          </span>
          {nevers.map((item, index) => (
            <span key={item} className="text-[11px] font-medium text-neutral-500">
              {index > 0 && <span className="pr-1.5 text-neutral-300">·</span>}
              {item}
            </span>
          ))}
        </div>
      </Enter>
      <Enter delay={3900}>
        <p className="text-xs font-medium text-neutral-500">
          it opens a draft — the editorial decision stays yours
        </p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 5 · One card ─────────────────────────────────────────────────────

function SceneOverride() {
  return (
    <Stage>
      <div className="w-full max-w-xs space-y-1.5">
        <Enter delay={1800}>
          <div className="flex items-center gap-2.5 rounded-xl border-2 border-neutral-900 bg-white px-3 py-2 shadow-sm">
            <IconOverride className="h-4 w-4 text-neutral-900" />
            <InitialsAvatar name="Sanne Willems" className="h-7 w-7 text-[10px]" />
            <span className="flex-1 text-sm font-semibold text-neutral-900">Sanne Willems</span>
            <span className="text-xs font-semibold text-neutral-400">54</span>
          </div>
        </Enter>
        {['Anna Bergmann', 'Ruben Oduya'].map((name, index) => (
          <Enter key={name} delay={200 + index * 400}>
            <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 opacity-70">
              <InitialsAvatar name={name} className="h-7 w-7 text-[10px]" />
              <span className="flex-1 text-sm font-medium text-neutral-600">{name}</span>
              <span className="text-xs font-semibold text-neutral-400">{index === 0 ? 82 : 71}</span>
            </div>
          </Enter>
        ))}
      </div>
      <Enter delay={3200}>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold text-neutral-600">
          <IconCheck className="h-3 w-3 text-neutral-400" />
          recorded as a deliberate decision
        </p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 6 · Getting to a yes ─────────────────────────────────────────────

function SceneTwoAsks() {
  return (
    <Stage>
      <div className="flex items-center gap-2">
        <Enter delay={200}>
          <div className="flex flex-col items-center gap-1">
            <InitialsAvatar name="Lina Vos" className="h-10 w-10 text-xs" />
            <span className="text-[11px] font-semibold text-neutral-600">Inspire2Live</span>
          </div>
        </Enter>
        <Enter delay={1200}>
          <div className="flex flex-col items-center gap-1">
            <IconHandshake className="h-5 w-5 text-neutral-400" />
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
              0.60
            </span>
          </div>
        </Enter>
        <Enter delay={2000}>
          <div className="flex flex-col items-center gap-1">
            <InitialsAvatar name="Anna Bergmann" className="h-10 w-10 text-xs" />
            <span className="text-[11px] font-semibold text-neutral-600">the guest</span>
          </div>
        </Enter>
      </div>
      <Enter delay={3000}>
        <div className="flex flex-col items-center gap-1.5">
          <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-600 shadow-sm">
            1 · “Do you know her?” — costs nothing, and “rather not” is an answer
          </span>
          <span className="rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-[11px] font-semibold text-white">
            2 · “Would you introduce us?” — only the strongest
          </span>
        </div>
      </Enter>
    </Stage>
  )
}

function SceneCeiling() {
  return (
    <Stage>
      <Enter delay={200}>
        <Label>Open asks</Label>
      </Enter>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <Enter key={slot} delay={600 + slot * 400}>
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${slot < 3 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-dashed border-neutral-300 bg-white text-neutral-300'}`}
            >
              <IconAsk className="h-4 w-4" />
            </span>
          </Enter>
        ))}
      </div>
      <Enter delay={3400}>
        <p className="text-xs font-medium text-neutral-500">
          think as widely as you like · chase only what you can carry
        </p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 7 · The loop ─────────────────────────────────────────────────────

function SceneHandover() {
  return (
    <Stage>
      <div className="flex items-center gap-2">
        <Enter delay={200}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-white text-neutral-800">
            <IconBooked className="h-5 w-5" />
          </span>
        </Enter>
        <Enter delay={900}>
          <span className="h-0.5 w-6 bg-neutral-800" />
        </Enter>
        <Enter delay={1200}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconRecorded className="h-5 w-5" />
          </span>
        </Enter>
        <Enter delay={2000}>
          <span className="h-0.5 w-6 bg-neutral-800" />
        </Enter>
        <Enter delay={2300}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-white text-neutral-800">
            <IconPlanning className="h-5 w-5" />
          </span>
        </Enter>
      </div>
      <Enter delay={3000}>
        <Card className="flex items-center gap-3 px-4 py-3">
          <InitialsAvatar name="Kwame Mensah" className="h-9 w-9 text-xs" />
          <div>
            <p className="text-sm font-semibold text-neutral-900">New episode</p>
            <p className="text-xs text-neutral-500">on the content calendar</p>
          </div>
        </Card>
      </Enter>
    </Stage>
  )
}

function SceneClosing() {
  return (
    <Stage>
      <Enter delay={200}>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 text-white">
          <IconQuestion className="h-8 w-8" />
        </span>
      </Enter>
      <Enter delay={1200}>
        <p className="text-center text-sm font-semibold text-neutral-900">
          A question worth asking, then names.
        </p>
      </Enter>
      <Enter delay={2200}>
        <p className="text-center text-xs font-medium text-neutral-500">One next move at a time.</p>
      </Enter>
    </Stage>
  )
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

export type ChapterId = 'why' | 'question' | 'people' | 'board' | 'card' | 'routes' | 'loop'

export const CHAPTERS: Array<{
  id: ChapterId
  label: string
  Icon: (props: { className?: string }) => React.JSX.Element
}> = [
  { id: 'why', label: 'Why', Icon: IconQuestion },
  { id: 'question', label: 'The question', Icon: IconCheck },
  { id: 'people', label: 'Finding people', Icon: IconPeople },
  { id: 'board', label: 'The board', Icon: IconBoard },
  { id: 'card', label: 'One card', Icon: IconStar },
  // Not "Getting a yes": that is now the name of the whole booking phase in the
  // opening scene, and two different things under one label is worse than a
  // plainer one. This chapter is specifically about opening the door.
  { id: 'routes', label: 'Reaching them', Icon: IconHandshake },
  { id: 'loop', label: 'The loop', Icon: IconPlanning },
]

// ─── The script ───────────────────────────────────────────────────────────────

/** Which real screen a scene puts on stage (rendered in `-screens.tsx`). */
export type ScreenId = 'questions' | 'board' | 'drawer' | 'routes' | 'people' | 'radar'

/**
 * The width each screen is laid out at before the stage scales it to the frame —
 * roughly the width it occupies in the app, so the six board columns and the
 * drawer's narrow column both look like themselves.
 */
export const SCREEN_WIDTH: Record<ScreenId, number> = {
  questions: 1040,
  board: 1180,
  drawer: 400,
  routes: 520,
  people: 880,
  // Wider than the card looks, so the whole proposal — evidence line, both
  // names and the two buttons — fits the stage without the camera moving.
  radar: 1020,
}

/**
 * Where to point the camera. `x`/`y` are a percentage of the screen being shown
 * and mark the point held in the middle of the stage; `scale` is 1 for the whole
 * screen and above that to zoom in. Panning is clamped to the screen's edges, so
 * a rough coordinate is enough.
 */
export type Focus = { scale: number; x: number; y: number }

export type Scene = {
  id: string
  chapter: ChapterId
  title: string
  caption: string
  /** Spoken aloud via speech synthesis while the scene plays. */
  narration: string
  /** Derived from the narration, so the bar tracks the voice. */
  duration: number
  /** A real screen, optionally zoomed… */
  screen?: ScreenId
  focus?: Focus
  /** …or a drawing, for the ideas that have no screen. */
  View?: () => React.JSX.Element
}

/**
 * How long the narration takes at the tour's calm speaking rate (~140 words a
 * minute), plus a beat of silence at the end. Browsers differ, so this is an
 * estimate — a scene that finishes early still waits for the voice.
 */
function narrationMs(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.round(words * 430 + 700)
}

const SCRIPT: Array<Omit<Scene, 'duration'>> = [
  // ── Why ────────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    chapter: 'why',
    title: 'How this space works',
    caption: 'One real question, from a blank page to a recording.',
    narration:
      "Welcome. This is where podcast episodes get planned. I'll show you how it works, and why it's built this way. We'll follow one real question, from a blank page all the way to a recording.",
    View: SceneWelcome,
  },
  {
    id: 'bottleneck',
    chapter: 'why',
    title: 'Getting a yes is the hard part',
    caption: 'Recording is the easy bit. Persuading the right person to come on is not.',
    narration:
      "Let's start with the problem. Recording an episode and editing it is the easy part. The hard work happens before any of that: finding the right guest, and persuading them to say yes. You have to pick a question worth asking, work out who can genuinely answer it, and reach them while it still matters.",
    View: SceneBottleneck,
  },
  {
    id: 'visible',
    chapter: 'why',
    title: 'Out of one inbox',
    caption: 'Work nobody can see cannot be shared, learned from, or handed over.',
    narration:
      "And normally all of that lives in one person's head and one inbox. Nobody else can see it. When somebody says no, nothing is learned from it. And a network of advocates across forty-five countries goes unused.",
    View: SceneVisible,
  },

  // ── The question ───────────────────────────────────────────────────────────
  {
    id: 'question-screen',
    chapter: 'question',
    title: 'Everything starts here',
    caption: 'The Questions screen — not a wishlist of famous names.',
    narration:
      "So everything starts here, on the Questions screen. And notice what this isn't. It's not a list of famous people we'd like to get. It's questions. A question being one sentence that somebody could reasonably disagree with.",
    screen: 'questions',
  },
  {
    id: 'question-example',
    chapter: 'question',
    title: 'The question we will follow',
    caption: 'Specific, current, and arguable — somebody could take the other side.',
    narration:
      "Here's the one we'll follow. Why is a proven diagnostic still not reimbursed, three years after parliament heard the case? Look at what makes that work. It's specific. You could argue the other side. And it's live right now, because the assessment reopened last month.",
    screen: 'questions',
    focus: { scale: 1.9, x: 34, y: 22 },
  },
  {
    id: 'question-gate',
    chapter: 'question',
    title: 'Five things before any name',
    caption: 'Question · why now · what a listener should do · where that points · format.',
    narration:
      "Before a question opens, five things have to be written down. The question. Why now. What a listener should actually do. Where that points. And the format. It's about twenty minutes of work, and it decides everything that follows.",
    screen: 'questions',
    focus: { scale: 2.4, x: 22, y: 40 },
  },
  {
    id: 'outlives',
    chapter: 'question',
    title: 'A question outlives a no',
    caption: 'The question is the folder; each person is a card inside it.',
    narration:
      "Each person we might invite becomes a card inside that question. And here's why that's the right way round. Most invitations get turned down. If we'd built this around people, one refusal would throw away all the thinking. This way, a no costs you one card.",
    View: SceneOutlives,
  },

  // ── Finding people ─────────────────────────────────────────────────────────
  {
    id: 'people-screen',
    chapter: 'people',
    title: 'One shared directory',
    caption: 'Past guests, members, CRM contacts, and people we have only read about.',
    narration:
      "Now, people. Everyone we could reach sits in one shared directory. Past guests, members and hubs, contacts from the CRM, and people we've only ever read about. The point being that nobody gets discovered twice.",
    screen: 'people',
  },
  {
    id: 'network-first',
    chapter: 'people',
    title: 'Inspire2Live first, then outward',
    caption: 'A warm route converts many times better than a cold one.',
    narration:
      "And the order we work through them matters. We start inside Inspire2Live. Past guests first, because they've already said yes once. Then members and hubs. Then the people they know. We only go outside when those are genuinely used up, because a warm introduction converts many times better than a cold email.",
    View: SceneNetworkFirst,
  },
  {
    id: 'suggest-guests',
    chapter: 'people',
    title: 'Ask for names, on any question',
    caption: 'One button reads the open scholarly record and comes back with people.',
    narration:
      "But sometimes you run out. When that happens, you can just ask. One button, on any live question. It reads the open scholarly record and comes back with people who've actually published on this. Usually in under a minute.",
    screen: 'questions',
    focus: { scale: 1.55, x: 30, y: 50 },
  },
  {
    id: 'radar-review',
    chapter: 'people',
    title: 'Or it comes to you',
    caption: 'Radar reads every fortnight and proposes the question, not just the names.',
    narration:
      "And you don't even have to ask. Every fortnight, Radar reads those same sources on its own. But watch what it brings back. Not just names. The question itself, something the podcast could be asking and isn't. Each one waiting as a single card.",
    screen: 'radar',
  },
  {
    id: 'radar-evidence',
    chapter: 'people',
    title: 'Two sources, or it does not appear',
    caption: 'Every name carries the paper that names them; the count is of records, not opinions.',
    narration:
      "Nothing gets onto this card from a single source. Here, two independent groups published within a fortnight of each other. And every person suggested carries the actual paper that names them, plus one line on what only they could say.",
    screen: 'radar',
    // No zoom, deliberately. The proposal card already fills the screen and its
    // text runs the full width, so any scale above 1 clips a word off one edge —
    // and how much depends on which of the three modal sizes the viewer chose.
    // This scene earns its place on the narration, not on the camera.
    focus: { scale: 1, x: 50, y: 40 },
  },
  {
    id: 'grounding',
    chapter: 'people',
    title: 'The model never sources a fact',
    caption: 'Names, affiliations and dates come from records. The model only groups and phrases.',
    narration:
      "This is the rule underneath all of it, and it's worth being clear about. Every fact comes from the catalogues. The names, the affiliations, the papers, the dates. The model is handed those records and it cannot add to them. All it does is group them and put them into words. So if a name isn't backed by a record, it gets dropped before it ever reaches you. Not flagged with a warning nobody reads. Dropped.",
    View: SceneGrounding,
  },
  {
    id: 'radar-accept',
    chapter: 'people',
    title: 'Accepting opens a draft',
    caption: 'A draft question and unscored cards — never a score, never a listener action.',
    narration:
      "Tick the names worth having, and accept. That opens a draft question, and puts those people on the wishlist as unscored cards. Now notice what it won't do. It never writes a score. It never decides what a listener should do. And it never moves anything past wishlist. The editorial call stays yours. And if it got this wrong, one tap says why, and that's the only thing Radar ever learns from.",
    View: SceneAccept,
  },

  // ── The board ──────────────────────────────────────────────────────────────
  {
    id: 'board-full',
    chapter: 'board',
    title: 'Everything in flight, on one board',
    caption: 'Six stages, left to right, grouped by the question they belong to.',
    narration:
      "So, the board. This is everything in flight, grouped by the question it belongs to. Six stages, running left to right: wishlist, research, ask, planning, booked, and recorded.",
    screen: 'board',
  },
  {
    id: 'board-left',
    chapter: 'board',
    title: 'Thinking is free',
    caption: 'List as many people as you like. One of them is the anchor.',
    narration:
      "On the left, thinking is free. List as many people as you like. One of them gets marked as the anchor, and that's the name that makes everything else easier if you land it. Then research answers one question: what can this person say that nobody else can?",
    screen: 'board',
    focus: { scale: 2.1, x: 16, y: 30 },
  },
  {
    id: 'board-ask',
    chapter: 'board',
    title: 'Amber means you are waiting',
    caption: 'One nudge at seven days; silence past fourteen is treated as a no.',
    narration:
      "When a card turns amber, it means it's with somebody else. That's a genuinely different situation from work you still owe, and the board treats it that way. From the moment a request goes out, the platform is counting. One nudge after seven days. And if it's still silent after fourteen, we treat that as a no.",
    screen: 'board',
    focus: { scale: 2.1, x: 45, y: 30 },
  },
  {
    id: 'board-nextup',
    chapter: 'board',
    title: '“Next up” finds your work',
    caption: 'Nudges due, silences past the cut-off, stalled bookings, sleepers waking.',
    narration:
      "And you should never have to scan this board hunting for your own work. Next up does that for you. It collects every card that needs a decision today. A nudge that's due. A silence past the cut-off. A booking that's stalled. Somebody you parked, who's now due to wake up.",
    screen: 'board',
    focus: { scale: 2.2, x: 22, y: 6 },
  },

  // ── One card ───────────────────────────────────────────────────────────────
  {
    id: 'drawer-full',
    chapter: 'card',
    title: 'One person, one question',
    caption: 'Who they are, where they sit, and the one next move — always at the top.',
    narration:
      "Let's open a card. One person, on one question. Who they are, where they sit, and the single next move, right at the top. Underneath that is the angle, and that's the part that really matters: what only Anna can say here. She sat on the panel that rejected this test. Twice.",
    screen: 'drawer',
  },
  {
    id: 'drawer-move',
    chapter: 'card',
    title: 'One button, and it explains itself',
    caption: 'A blocked move says what is missing instead of failing silently.',
    narration:
      "There's only ever one button. And when a move is blocked, it tells you exactly what's missing, instead of just failing. Worth knowing: those rules live on the server, not in the form. So you can't get around them by clicking somewhere else.",
    screen: 'drawer',
    focus: { scale: 1.8, x: 50, y: 12 },
  },
  {
    id: 'drawer-score',
    chapter: 'card',
    title: 'A score you can argue with',
    caption: 'A hundred points from six parts, and the arithmetic is always shown.',
    narration:
      "Every card scores out of a hundred, built from six parts. Chance of a yes, reach, timeliness, follow-up, mission fit and format. And the breakdown is always shown. That's deliberate, because a number you can't argue with is a number you shouldn't trust.",
    screen: 'drawer',
    focus: { scale: 1.8, x: 50, y: 32 },
  },
  {
    id: 'override',
    chapter: 'card',
    title: 'It ranks; you decide',
    caption: 'Any card can be pushed to the top — with the reason kept.',
    narration:
      "Because the score ranks, and you decide. You can push any card straight to the top, and the platform records that you did, along with your reason. And if that same override keeps turning out to be right, then the scoring is wrong. Not the person.",
    View: SceneOverride,
  },

  // ── Getting a yes ──────────────────────────────────────────────────────────
  {
    id: 'routes-screen',
    chapter: 'routes',
    title: 'Who can open the door',
    caption: 'Routes ranked by strength, and by whether a human confirmed them.',
    narration:
      "So how do we actually reach Anna? For every person, the platform lays out the routes in. Who could open the door, how strong that connection is, and, this part matters, whether a human has confirmed it or the platform is only guessing.",
    screen: 'routes',
  },
  {
    id: 'two-asks',
    chapter: 'routes',
    title: 'Two asks, in this order',
    caption: 'The cheap question first; the favour only to the strongest contact.',
    narration:
      "And there are two asks, always in this order. The cheap one first: do you know her? Where saying no is a perfectly good answer. Only then, and only the strongest confirmed contact, gets asked for an actual introduction. Goodwill is scarce, so we spend it carefully.",
    View: SceneTwoAsks,
  },
  {
    id: 'ceiling',
    chapter: 'routes',
    title: 'Chasing is capped at six',
    caption: 'Wishlist and research are unlimited. Open asks are not.',
    narration:
      "Which is exactly why chasing is capped. Six open asks at a time, across every question you have. Wishlist and research stay unlimited. So think as widely as you like. Just don't chase more than you can carry.",
    View: SceneCeiling,
  },

  // ── The loop ───────────────────────────────────────────────────────────────
  {
    id: 'handover',
    chapter: 'loop',
    title: 'Recorded hands over',
    caption: 'The planner feeds the content calendar; it never duplicates it.',
    narration:
      "And once the recording exists, the card closes and creates an item on the content calendar. The planner feeds the calendar. It never duplicates it. And the guest you just recorded becomes an introducer for the next question. That's the loop closing.",
    View: SceneHandover,
  },
  {
    id: 'closing',
    chapter: 'loop',
    title: 'Start with a question',
    caption: 'A question worth asking first, names second, one next move at a time.',
    narration:
      "So that's it. If you remember one thing, make it the order. A question worth asking comes first. Names come second. Then one next move at a time.",
    View: SceneClosing,
  },
]

export const SCENES: Scene[] = SCRIPT.map((scene) => ({
  ...scene,
  duration: narrationMs(scene.narration),
}))

export const TOTAL_MS = SCENES.reduce((sum, scene) => sum + scene.duration, 0)

/** Index of the first scene of each chapter — what the chapter rail jumps to. */
export const CHAPTER_START: Record<ChapterId, number> = CHAPTERS.reduce(
  (map, chapter) => {
    map[chapter.id] = SCENES.findIndex((scene) => scene.chapter === chapter.id)
    return map
  },
  {} as Record<ChapterId, number>
)
