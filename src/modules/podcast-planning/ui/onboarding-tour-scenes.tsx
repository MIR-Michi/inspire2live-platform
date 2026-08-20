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
  const steps = [
    { label: 'Question', hot: false },
    { label: 'Booking', hot: true },
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
          the scarce hour is spent here — not in the edit
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
  { id: 'routes', label: 'Getting a yes', Icon: IconHandshake },
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
      'Welcome to the podcast planning space. This is how it works, and why it is shaped this way. We will follow one real question the whole way through.',
    View: SceneWelcome,
  },
  {
    id: 'bottleneck',
    chapter: 'why',
    title: 'Booking is the hard part',
    caption: 'The scarce resource is not editing. It is getting the right person to say yes.',
    narration:
      'Editing is not the bottleneck. The hard part is booking: choosing a question worth asking, working out who can actually answer it, and reaching them before the moment passes.',
    View: SceneBottleneck,
  },
  {
    id: 'visible',
    chapter: 'why',
    title: 'Out of one inbox',
    caption: 'Booking work nobody can see cannot be shared, learned from, or handed over.',
    narration:
      'Normally that work lives in one head and one inbox. Nobody else sees it, nothing is learned from a refusal, and a network of advocates in forty-five countries goes unused.',
    View: SceneVisible,
  },

  // ── The question ───────────────────────────────────────────────────────────
  {
    id: 'question-screen',
    chapter: 'question',
    title: 'Everything starts here',
    caption: 'The Questions screen — not a wishlist of famous names.',
    narration:
      'Everything starts on the Questions screen, not with a list of famous names. A question is one sentence somebody could disagree with — the unit this space is built on.',
    screen: 'questions',
  },
  {
    id: 'question-example',
    chapter: 'question',
    title: 'The question we will follow',
    caption: 'Specific, current, and arguable — somebody could take the other side.',
    narration:
      'Here is the one we will follow. Why is a proven diagnostic still unreimbursed, three years after parliament heard the case? Specific, arguable, and happening now: the assessment reopened last month.',
    screen: 'questions',
    focus: { scale: 1.9, x: 34, y: 22 },
  },
  {
    id: 'question-gate',
    chapter: 'question',
    title: 'Five things before any name',
    caption: 'Question · why now · what a listener should do · where that points · format.',
    narration:
      'A question opens only once five things are written down: the question, why now, what a listener should do, where that points, and the format. Those twenty minutes decide everything downstream.',
    screen: 'questions',
    focus: { scale: 2.4, x: 22, y: 40 },
  },
  {
    id: 'outlives',
    chapter: 'question',
    title: 'A question outlives a no',
    caption: 'The question is the folder; each person is a card inside it.',
    narration:
      'Each person becomes a card inside that question. Most invitations fail — if the question were a person, one refusal would throw away all the framing work. Here a no costs one card.',
    View: SceneOutlives,
  },

  // ── Finding people ─────────────────────────────────────────────────────────
  {
    id: 'people-screen',
    chapter: 'people',
    title: 'One shared directory',
    caption: 'Past guests, members, CRM contacts, and people we have only read about.',
    narration:
      'Now the names. Everyone we could reach sits in one directory: past guests, members and hubs, CRM contacts, and people we have only read about. Nobody is rediscovered twice.',
    screen: 'people',
  },
  {
    id: 'network-first',
    chapter: 'people',
    title: 'Inspire2Live first, then outward',
    caption: 'A warm route converts many times better than a cold one.',
    narration:
      'The order matters. Inside Inspire2Live first: past guests who said yes once, then members and hubs, then the people they know. Outward only when those rings are exhausted — a warm route converts far better.',
    View: SceneNetworkFirst,
  },
  {
    id: 'suggest-guests',
    chapter: 'people',
    title: 'Ask for names, on any question',
    caption: 'One button reads the open scholarly record and comes back with people.',
    narration:
      'When those rings run out, ask. One button on any live question reads the open scholarly record and comes back with people who have actually published on it — usually in under a minute.',
    screen: 'questions',
    focus: { scale: 1.55, x: 30, y: 50 },
  },
  {
    id: 'radar-review',
    chapter: 'people',
    title: 'Or it comes to you',
    caption: 'Radar reads every fortnight and proposes the question, not just the names.',
    narration:
      'You do not have to ask. Every fortnight Radar reads the same sources and proposes questions the podcast could be asking — each one a single card, waiting on the Radar tab.',
    screen: 'radar',
  },
  {
    id: 'radar-evidence',
    chapter: 'people',
    title: 'Two sources, or it does not appear',
    caption: 'Every name carries the paper that names them; the count is of records, not opinions.',
    narration:
      'Nothing reaches this card on one source. Two independent groups published inside a fortnight, and each suggested person carries the paper that names them, with one line on what only they could say.',
    screen: 'radar',
    focus: { scale: 1.4, x: 30, y: 34 },
  },
  {
    id: 'grounding',
    chapter: 'people',
    title: 'The model never sources a fact',
    caption: 'Names, affiliations and dates come from records. The model only groups and phrases.',
    narration:
      'That is the rule underneath all of it. Names, affiliations, papers and dates come from the catalogues; the model is handed records it cannot add to, and only groups and phrases them. A name no record backs is dropped before you ever see it, rather than shown with a warning nobody reads.',
    View: SceneGrounding,
  },
  {
    id: 'radar-accept',
    chapter: 'people',
    title: 'Accepting opens a draft',
    caption: 'A draft question and unscored cards — never a score, never a listener action.',
    narration:
      'Tick the names worth having and accept. That opens a draft question and puts unscored cards on the wishlist — it never writes a score, never invents what a listener should do, and never moves anything past wishlist. If it is wrong, one tap says why, and that is the only thing Radar learns from.',
    View: SceneAccept,
  },

  // ── The board ──────────────────────────────────────────────────────────────
  {
    id: 'board-full',
    chapter: 'board',
    title: 'Everything in flight, on one board',
    caption: 'Six stages, left to right, grouped by the question they belong to.',
    narration:
      'This is the board: everything in flight, grouped by question, six stages running left to right — wishlist, research, ask, planning, booked, recorded.',
    screen: 'board',
  },
  {
    id: 'board-left',
    chapter: 'board',
    title: 'Thinking is free',
    caption: 'List as many people as you like. One of them is the anchor.',
    narration:
      'On the left, thinking is free — list as many as you like. One is the anchor: secure that name and the rest get easier. Research asks what this person can say that nobody else can.',
    screen: 'board',
    focus: { scale: 2.1, x: 16, y: 30 },
  },
  {
    id: 'board-ask',
    chapter: 'board',
    title: 'Amber means you are waiting',
    caption: 'One nudge at seven days; silence past fourteen is treated as a no.',
    narration:
      'Amber means the card is with somebody else — a different problem from work you owe. Once a request is out the platform counts: one nudge after seven days, silence past fourteen is a no.',
    screen: 'board',
    focus: { scale: 2.1, x: 45, y: 30 },
  },
  {
    id: 'board-nextup',
    chapter: 'board',
    title: '“Next up” finds your work',
    caption: 'Nudges due, silences past the cut-off, stalled bookings, sleepers waking.',
    narration:
      'You never scan the board for your work. Next up collects every card needing a decision today: a nudge due, a silence past the cut-off, a stalled booking, a sleeper waking.',
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
      'Open a card: one person on one question. Who they are, where they sit, and the single next move. Underneath, the angle — what only Anna can say. She sat on the panel that rejected the test twice.',
    screen: 'drawer',
  },
  {
    id: 'drawer-move',
    chapter: 'card',
    title: 'One button, and it explains itself',
    caption: 'A blocked move says what is missing instead of failing silently.',
    narration:
      'There is only ever one button, and a blocked move says what is missing. The rules live in the server, not in the form, so they cannot be skipped by clicking somewhere else.',
    screen: 'drawer',
    focus: { scale: 1.8, x: 50, y: 12 },
  },
  {
    id: 'drawer-score',
    chapter: 'card',
    title: 'A score you can argue with',
    caption: 'A hundred points from six parts, and the arithmetic is always shown.',
    narration:
      'A score out of a hundred from six parts: chance of a yes, reach, timeliness, follow-up, mission and format. The breakdown is always there — a number you cannot argue with is one you should not trust.',
    screen: 'drawer',
    focus: { scale: 1.8, x: 50, y: 32 },
  },
  {
    id: 'override',
    chapter: 'card',
    title: 'It ranks; you decide',
    caption: 'Any card can be pushed to the top — with the reason kept.',
    narration:
      'It ranks; you decide. Push any card to the top and that is recorded, with a reason. An override that keeps turning out right means the model is wrong, not the person.',
    View: SceneOverride,
  },

  // ── Getting a yes ──────────────────────────────────────────────────────────
  {
    id: 'routes-screen',
    chapter: 'routes',
    title: 'Who can open the door',
    caption: 'Routes ranked by strength, and by whether a human confirmed them.',
    narration:
      'So how do we reach her? For each person the platform lists the routes in: who might open the door, how strong the tie is, and whether a human confirmed it or the platform merely suspects it.',
    screen: 'routes',
  },
  {
    id: 'two-asks',
    chapter: 'routes',
    title: 'Two asks, in this order',
    caption: 'The cheap question first; the favour only to the strongest contact.',
    narration:
      'Two asks, in this order. The cheap one first — do you know her? — where rather not is a fine answer. Only the strongest confirmed contact is asked for an introduction. Goodwill is scarce.',
    View: SceneTwoAsks,
  },
  {
    id: 'ceiling',
    chapter: 'routes',
    title: 'Chasing is capped at six',
    caption: 'Wishlist and research are unlimited. Open asks are not.',
    narration:
      'Which is why chasing is capped: six open asks at a time, across every question. Wishlist and research stay unlimited. Think as widely as you like, chase only what you can carry.',
    View: SceneCeiling,
  },

  // ── The loop ───────────────────────────────────────────────────────────────
  {
    id: 'handover',
    chapter: 'loop',
    title: 'Recorded hands over',
    caption: 'The planner feeds the content calendar; it never duplicates it.',
    narration:
      'When the recording exists, the card closes and creates an item on the content calendar. The planner feeds the calendar, never duplicates it. And the guest becomes an introducer for the next question.',
    View: SceneHandover,
  },
  {
    id: 'closing',
    chapter: 'loop',
    title: 'Start with a question',
    caption: 'A question worth asking first, names second, one next move at a time.',
    narration:
      'That is the loop. Remember the order: a question worth asking first, names second, one next move at a time.',
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
