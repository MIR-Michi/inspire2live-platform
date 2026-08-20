'use client'

/**
 * podcast-planning/ui/onboarding-tour-scenes.tsx — the script the tour plays.
 *
 * Twenty scenes in six chapters: what the space is *for* before what its
 * buttons do. The rationale spoken here is the reasoning recorded in
 * `docs/PODCAST_OPPORTUNITY_ENGINE_CONCEPT.md` (§1 why it exists · §2 question
 * before names · §3 the stages and gates · §3 the one limit · §7/§8/§10 score
 * and routes) — when that thinking changes, change it here too.
 *
 * Every visual is assembled from the planner's own icons and card shapes, so
 * the tour teaches the screens the user is about to use rather than a drawing
 * of them. Scene length is derived from the narration (see `narrationMs`) so
 * the progress bar tracks the voice instead of racing ahead of it.
 */

import {
  IconAsk,
  IconBoard,
  IconBooked,
  IconCheck,
  IconClock,
  IconClose,
  IconHandshake,
  IconOverride,
  IconPlanning,
  IconQuestion,
  IconRecorded,
  IconResearch,
  IconSleep,
  IconStar,
  IconWishlist,
  InitialsAvatar,
  STAGE_ICONS,
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 text-neutral-400">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
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

// ─── Chapter 2 · The question comes before the names ──────────────────────────

function SceneLevels() {
  return (
    <Stage>
      <Enter delay={200}>
        <div className="w-full max-w-sm rounded-2xl border-2 border-neutral-800 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-neutral-800">
            <IconQuestion className="h-3.5 w-3.5" />
            Question
          </p>
          <Enter delay={1200}>
            <div className="rounded-xl border border-neutral-400 bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
                <InitialsAvatar name="Maria Santos" className="h-5 w-5 text-[9px]" />
                Person
              </p>
              <Enter delay={2200}>
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                    <IconAsk className="h-3 w-3" />
                    Invitation
                  </p>
                </div>
              </Enter>
            </div>
          </Enter>
        </div>
      </Enter>
    </Stage>
  )
}

function SceneOutlives() {
  const people = ['Maria Santos', 'John Weber', 'Aisha Khan']
  return (
    <Stage>
      <Enter delay={200}>
        <Card className="w-full max-w-sm">
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

function SceneQuestionFields() {
  return (
    <Stage>
      <Enter delay={200}>
        <Card className="w-full max-w-sm px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <IconQuestion className="h-4 w-4 shrink-0 text-neutral-400" />
            Why is a proven diagnostic still unreimbursed?
          </p>
        </Card>
      </Enter>
      <div className="flex max-w-sm flex-wrap justify-center gap-1.5">
        <ChipMock label="Question" delay={1400} />
        <ChipMock label="Why now" delay={2200} />
        <ChipMock label="Action" delay={3000} />
        <ChipMock label="Link" delay={3800} />
        <ChipMock label="Format" delay={4600} />
      </div>
    </Stage>
  )
}

function SceneAnchor() {
  const people = ['Maria Santos', 'John Weber', 'Aisha Khan', 'Tom Verhoeven']
  return (
    <Stage>
      <div className="w-full max-w-xs rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
          <IconWishlist className="h-3.5 w-3.5 text-neutral-400" />
          Wishlist
        </p>
        <ul className="space-y-1.5">
          {people.map((name, index) => (
            <li key={name}>
              <Enter delay={400 + index * 500}>
                <div
                  className={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-1.5 shadow-sm ${index === 0 ? 'border-orange-300 ring-2 ring-orange-100' : 'border-neutral-200'}`}
                >
                  <InitialsAvatar name={name} className="h-7 w-7 text-[10px]" />
                  <span className="flex-1 text-sm font-semibold text-neutral-900">{name}</span>
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800">
                      <IconStar className="h-3 w-3" filled />
                      Anchor
                    </span>
                  ) : (
                    <Enter delay={3200}>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        +3
                      </span>
                    </Enter>
                  )}
                </div>
              </Enter>
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  )
}

// ─── Chapter 3 · The six stages ───────────────────────────────────────────────

const PIPELINE = ['wishlist', 'research', 'ask', 'planning', 'booked', 'recorded'] as const

function Stepper({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="flex items-center">
      {PIPELINE.map((stage, index) => {
        const Icon = STAGE_ICONS[stage]
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo'
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
  )
}

function SceneStages() {
  return (
    <Stage>
      <Enter delay={200}>
        <Stepper activeIndex={-1} />
      </Enter>
      <Enter delay={1600}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-500">
            <IconSleep className="h-3.5 w-3.5 text-neutral-400" />
            Not now
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-500">
            <IconClose className="h-3.5 w-3.5 text-neutral-400" />
            Closed
          </span>
        </div>
      </Enter>
      <Enter delay={2800}>
        <p className="text-xs font-medium text-neutral-500">two exits — one sleeps, one keeps the reason</p>
      </Enter>
    </Stage>
  )
}

function SceneResearch() {
  return (
    <Stage>
      <Enter delay={200}>
        <Card className="w-full max-w-sm px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <IconResearch className="h-4 w-4 shrink-0 text-neutral-400" />
            What can only they say?
          </p>
        </Card>
      </Enter>
      <div className="w-full max-w-sm space-y-1.5">
        <Enter delay={1600}>
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
            <IconCheck className="h-3.5 w-3.5 shrink-0" />
            “I signed the decision that delayed it.”
          </p>
        </Enter>
        <Enter delay={3000}>
          <p className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-400">
            <IconClose className="h-3.5 w-3.5 shrink-0" />
            <span className="line-through">“Senior person in the field.”</span>
          </p>
        </Enter>
      </div>
    </Stage>
  )
}

function SceneOneMove() {
  return (
    <Stage>
      <Enter delay={200}>
        <Stepper activeIndex={1} />
      </Enter>
      <div className="w-full max-w-xs space-y-2">
        <Enter delay={1400}>
          <span className="flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white">
            <IconAsk className="h-4 w-4" />
            Ask
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Enter>
        <Enter delay={3000}>
          <div className="space-y-1">
            <span className="flex items-center justify-center gap-2 rounded-xl bg-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-500">
              <IconAsk className="h-4 w-4" />
              Ask
            </span>
            <p className="text-center text-[11px] leading-4 text-amber-900">
              Needs an angle and a route before asking.
            </p>
          </div>
        </Enter>
      </div>
    </Stage>
  )
}

function SceneDays() {
  const marks = [
    { day: 'Day 0', label: 'sent', tone: 'text-neutral-700' },
    { day: 'Day 7', label: 'one nudge', tone: 'text-amber-800' },
    { day: 'Day 14', label: 'treated as no', tone: 'text-red-700' },
  ]
  return (
    <Stage>
      <div className="flex w-full max-w-sm items-start justify-between">
        {marks.map((mark, index) => (
          <div key={mark.day} className="flex flex-1 items-start">
            {index > 0 && <span className="mt-3 h-0.5 flex-1 bg-neutral-200" />}
            <Enter delay={400 + index * 1600}>
              <div className="flex w-20 flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white ${index === 2 ? 'border-red-300 text-red-600' : index === 1 ? 'border-amber-300 text-amber-600' : 'border-neutral-300 text-neutral-500'}`}
                >
                  <IconClock className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold text-neutral-700">{mark.day}</span>
                <span className={`text-[11px] font-medium ${mark.tone}`}>{mark.label}</span>
              </div>
            </Enter>
          </div>
        ))}
      </div>
      <Enter delay={5000}>
        <p className="text-xs font-medium text-neutral-500">the platform keeps the calendar, not your memory</p>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 4 · One limit, on purpose ────────────────────────────────────────

function SceneWaiting() {
  return (
    <Stage>
      <div className="flex items-start gap-3">
        <Enter delay={200}>
          <div className="w-36 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
              <span className="flex items-center gap-1.5">
                <IconAsk className="h-3.5 w-3.5 text-amber-600" />
                Ask
              </span>
              <IconClock className="h-3 w-3 text-amber-600" />
            </p>
            <Card>
              <div className="flex items-center gap-2">
                <InitialsAvatar name="Maria Santos" className="h-7 w-7 text-[10px]" />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                  <IconClock className="h-3 w-3" />
                  9d
                </span>
              </div>
            </Card>
          </div>
        </Enter>
        <Enter delay={1600}>
          <div className="w-36 rounded-xl border border-neutral-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-600">
              <IconResearch className="h-3.5 w-3.5 text-neutral-400" />
              Research
            </p>
            <Card className="border-neutral-200">
              <div className="flex items-center gap-2">
                <InitialsAvatar name="Aisha Khan" className="h-7 w-7 text-[10px]" />
                <span className="text-[11px] font-semibold text-neutral-600">your move</span>
              </div>
            </Card>
          </div>
        </Enter>
      </div>
      <Enter delay={3000}>
        <p className="text-xs font-medium text-neutral-500">amber waits on them · white waits on you</p>
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
          three of six used — every open ask costs somebody&rsquo;s goodwill
        </p>
      </Enter>
    </Stage>
  )
}

function SceneAsymmetry() {
  return (
    <Stage>
      <div className="flex items-center gap-3">
        <Enter delay={200}>
          <div className="w-36 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-neutral-900">∞</p>
            <p className="mt-1 text-xs font-semibold text-neutral-700">Wishlist · Research</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">think as widely as you like</p>
          </div>
        </Enter>
        <Enter delay={1800}>
          <div className="w-36 rounded-xl border-2 border-neutral-900 bg-neutral-950 px-4 py-3 text-center text-white shadow-sm">
            <p className="text-2xl font-bold">6</p>
            <p className="mt-1 text-xs font-semibold">Ask</p>
            <p className="mt-0.5 text-[11px] text-neutral-300">chase only what you can carry</p>
          </div>
        </Enter>
      </div>
    </Stage>
  )
}

// ─── Chapter 5 · Judgement: the score and the routes ──────────────────────────

function SceneScore() {
  const parts = [
    { label: 'Yes', width: 'w-16' },
    { label: 'Reach', width: 'w-12' },
    { label: 'Timing', width: 'w-14' },
    { label: 'Follow-up', width: 'w-8' },
    { label: 'Mission', width: 'w-12' },
    { label: 'Format', width: 'w-4' },
  ]
  return (
    <Stage>
      <div className="flex items-center gap-4">
        <Enter delay={200}>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold tracking-tight text-neutral-900">82</span>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Chase now
            </span>
          </div>
        </Enter>
        <div className="space-y-1">
          {parts.map((part, index) => (
            <Enter key={part.label} delay={900 + index * 450}>
              <div className="flex items-center gap-2">
                <span className="w-16 text-right text-[11px] font-medium text-neutral-500">
                  {part.label}
                </span>
                <span className={`h-2 rounded-full bg-neutral-800 ${part.width}`} />
              </div>
            </Enter>
          ))}
        </div>
      </div>
      <Enter delay={4000}>
        <p className="text-xs font-medium text-neutral-500">the breakdown is always shown, never just the number</p>
      </Enter>
    </Stage>
  )
}

function SceneOverride() {
  return (
    <Stage>
      <div className="w-full max-w-xs space-y-1.5">
        <Enter delay={1800}>
          <div className="flex items-center gap-2.5 rounded-xl border-2 border-neutral-900 bg-white px-3 py-2 shadow-sm">
            <IconOverride className="h-4 w-4 text-neutral-900" />
            <InitialsAvatar name="Tom Verhoeven" className="h-7 w-7 text-[10px]" />
            <span className="flex-1 text-sm font-semibold text-neutral-900">Tom Verhoeven</span>
            <span className="text-xs font-semibold text-neutral-400">54</span>
          </div>
        </Enter>
        {['Maria Santos', 'Aisha Khan'].map((name, index) => (
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

function SceneRoutes() {
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
              0.85
            </span>
          </div>
        </Enter>
        <Enter delay={2000}>
          <div className="flex flex-col items-center gap-1">
            <InitialsAvatar name="Maria Santos" className="h-10 w-10 text-xs" />
            <span className="text-[11px] font-semibold text-neutral-600">the guest</span>
          </div>
        </Enter>
      </div>
      <Enter delay={3000}>
        <div className="flex flex-col items-center gap-1.5">
          <span className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-600 shadow-sm">
            1 · “Do you know her?” — costs nothing
          </span>
          <span className="rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-[11px] font-semibold text-white">
            2 · “Would you introduce us?” — only the strongest
          </span>
        </div>
      </Enter>
    </Stage>
  )
}

// ─── Chapter 6 · Your day ─────────────────────────────────────────────────────

function SceneNextUp() {
  return (
    <Stage>
      <Enter delay={200}>
        <Label>Next up</Label>
      </Enter>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        <Enter delay={900}>
          <span className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
            <InitialsAvatar name="John Weber" className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-semibold text-neutral-800">John Weber</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Nudge due
            </span>
          </span>
        </Enter>
        <Enter delay={2100}>
          <span className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
            <InitialsAvatar name="Aisha Khan" className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-semibold text-neutral-800">Aisha Khan</span>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              No reply
            </span>
          </span>
        </Enter>
        <Enter delay={3300}>
          <span className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
            <InitialsAvatar name="Tom Verhoeven" className="h-7 w-7 text-[10px]" />
            <span className="text-sm font-semibold text-neutral-800">Tom Verhoeven</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
              Date drifting
            </span>
          </span>
        </Enter>
      </div>
    </Stage>
  )
}

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
          <InitialsAvatar name="Maria Santos" className="h-9 w-9 text-xs" />
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

export type ChapterId = 'why' | 'questions' | 'stages' | 'limits' | 'judgement' | 'day'

export const CHAPTERS: Array<{
  id: ChapterId
  label: string
  Icon: (props: { className?: string }) => React.JSX.Element
}> = [
  { id: 'why', label: 'Why', Icon: IconQuestion },
  { id: 'questions', label: 'Questions', Icon: IconWishlist },
  { id: 'stages', label: 'Stages', Icon: IconBoard },
  { id: 'limits', label: 'Limits', Icon: IconClock },
  { id: 'judgement', label: 'Judgement', Icon: IconStar },
  { id: 'day', label: 'Your day', Icon: IconPlanning },
]

// ─── The script ───────────────────────────────────────────────────────────────

export type Scene = {
  id: string
  chapter: ChapterId
  title: string
  caption: string
  /** Spoken aloud via speech synthesis while the scene plays. */
  narration: string
  /** Derived from the narration, so the bar tracks the voice. */
  duration: number
  View: () => React.JSX.Element
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
  {
    id: 'welcome',
    chapter: 'why',
    title: 'How this space works',
    caption: 'Four minutes on the workflow — and the thinking behind it.',
    narration:
      'Welcome. In four minutes, this explains not just where things are, but why the workflow is shaped this way.',
    View: SceneWelcome,
  },
  {
    id: 'bottleneck',
    chapter: 'why',
    title: 'Booking is the hard part',
    caption: 'The scarce resource is not editing. It is getting the right person to say yes.',
    narration:
      'Editing is not the bottleneck. The hard part is booking: choosing a question worth asking, working out who can answer it, and reaching them.',
    View: SceneBottleneck,
  },
  {
    id: 'visible',
    chapter: 'why',
    title: 'Out of one inbox',
    caption: 'Booking work that nobody can see cannot be shared, learned from, or handed over.',
    narration:
      'It lives in one head and one inbox: nobody else sees it, nothing is learned from a refusal, and a network of advocates in forty-five countries goes unused.',
    View: SceneVisible,
  },
  {
    id: 'levels',
    chapter: 'questions',
    title: 'Three levels, nested',
    caption: 'A question · the people who could answer it · each attempt to reach one of them.',
    narration:
      'Everything sits on three levels: the question being asked, the people who could answer it, and each attempt to reach one of them.',
    View: SceneLevels,
  },
  {
    id: 'outlives',
    chapter: 'questions',
    title: 'A question outlives a no',
    caption: 'The card is the person; the question is the folder they sit in.',
    narration:
      'The card is the person; the question is the folder they sit in. Otherwise one refusal would throw away all the framing work. This way, a no costs one card.',
    View: SceneOutlives,
  },
  {
    id: 'fields',
    chapter: 'questions',
    title: 'Written down before any name',
    caption: 'The question, why now, what a listener should do, and the format it fits.',
    narration:
      'So a question opens only once the essentials are down: the question itself, why it matters now, what a listener should do afterwards, and its format.',
    View: SceneQuestionFields,
  },
  {
    id: 'anchor',
    chapter: 'questions',
    title: 'Many names, one anchor',
    caption: 'Most invitations fail — so a wishlist makes a no an inconvenience, not a restart.',
    narration:
      'Then list many people, because most invitations fail. One is the anchor: land that name first, and every other name becomes easier to win.',
    View: SceneAnchor,
  },
  {
    id: 'stages',
    chapter: 'stages',
    title: 'Six stages, two exits',
    caption: 'Wishlist · research · ask · planning · booked · recorded.',
    narration:
      'Each person moves through six stages: wishlist, research, ask, planning, booked, recorded. Two exits catch the rest: not now, which sleeps and returns, and closed, with a reason.',
    View: SceneStages,
  },
  {
    id: 'research',
    chapter: 'stages',
    title: 'Research is the gate',
    caption: 'What can this person say that nobody else can?',
    narration:
      'Research decides quality: what can this person say that nobody else can? If the answer is only that they are senior in the field, that is not an angle.',
    View: SceneResearch,
  },
  {
    id: 'one-move',
    chapter: 'stages',
    title: 'One next move',
    caption: 'A single button per card — and if it is blocked, it says what is missing.',
    narration:
      'From there, each card offers exactly one next move, as a single button. If blocked, it says what is missing, so you need not remember the rules.',
    View: SceneOneMove,
  },
  {
    id: 'days',
    chapter: 'stages',
    title: 'The platform counts the days',
    caption: 'One nudge at seven days. Silence past fourteen is treated as a no.',
    narration:
      'Once a request is out, the platform counts the days. One nudge after seven. Silence past fourteen counts as a no, and the card returns for a different route.',
    View: SceneDays,
  },
  {
    id: 'waiting',
    chapter: 'limits',
    title: 'Waiting is not to-do',
    caption: 'Amber columns are with somebody else. White ones are with you.',
    narration:
      'Two stages are waiting states, shown in amber, because waiting on someone else and having work to do are different problems that should never look alike.',
    View: SceneWaiting,
  },
  {
    id: 'ceiling',
    chapter: 'limits',
    title: 'Chasing is capped at six',
    caption: 'Every open request needs following up, and spends somebody’s goodwill.',
    narration:
      'Research is unlimited; chasing is not. Six open asks at a time, because every request needs following up and every introduction spends somebody’s goodwill.',
    View: SceneCeiling,
  },
  {
    id: 'asymmetry',
    chapter: 'limits',
    title: 'A pipeline, not a backlog',
    caption: 'Think as widely as you like; chase only what you can carry.',
    narration:
      'That asymmetry is deliberate: think as widely as you like, chase only what you can carry. An unlimited list only makes you feel behind.',
    View: SceneAsymmetry,
  },
  {
    id: 'score',
    chapter: 'judgement',
    title: 'A score you can argue with',
    caption: 'Out of a hundred, from six parts — the breakdown is always visible.',
    narration:
      'Each person carries a score out of a hundred: chance of a yes, reach, timeliness, follow-up, mission and format. The breakdown is always shown, never just the number.',
    View: SceneScore,
  },
  {
    id: 'override',
    chapter: 'judgement',
    title: 'It ranks; you decide',
    caption: 'Any card can be pushed to the top — and that choice is recorded.',
    narration:
      'The score ranks; it never decides. Push any card to the top and that is recorded as a deliberate choice, because an override that keeps being right means the model is wrong.',
    View: SceneOverride,
  },
  {
    id: 'routes',
    chapter: 'judgement',
    title: 'Two asks, in this order',
    caption: 'The cheap question first; the favour only to the strongest contact.',
    narration:
      'Routes come from the network: the platform suggests who might know your guest, then asks them one cheap question. Only the strongest confirmed contact is asked for the favour.',
    View: SceneRoutes,
  },
  {
    id: 'next-up',
    chapter: 'day',
    title: '“Next up” finds your work',
    caption: 'Nudges due, silences past the cut-off, bookings that stalled.',
    narration:
      'Day to day, you do not scan columns. The Next up strip collects every card needing a decision: a nudge due, a silence past the cut-off, a stalled booking.',
    View: SceneNextUp,
  },
  {
    id: 'handover',
    chapter: 'day',
    title: 'Recorded hands over',
    caption: 'The planner feeds the content calendar; it never duplicates it.',
    narration:
      'When the recording exists, the card closes and creates an item on the content calendar. The planner feeds the calendar; it never duplicates it.',
    View: SceneHandover,
  },
  {
    id: 'closing',
    chapter: 'day',
    title: 'Start with a question',
    caption: 'A question worth asking first, names second, one next move at a time.',
    narration:
      'That is the loop. If you remember one thing, remember the order: a question worth asking first, names second, one next move at a time.',
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
