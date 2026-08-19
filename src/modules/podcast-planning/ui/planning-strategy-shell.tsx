/**
 * podcast-planning/ui/planning-strategy-shell.tsx — the Planning & Strategy tab.
 *
 * Concept §4. Four screens in Phase A (Board · Questions · People ·
 * Introductions), navigated by an icon pill row — since the 2026-08 UX pass the
 * screens explain themselves visually instead of carrying a blurb, and Phase
 * B's Radar/Results are not named at all: an empty tab teaches nothing.
 *
 * This is the composition point between the two components: it loads the board
 * from `podcast-planning` and the people/routes/introductions from `network`'s
 * public API. It does the loading itself so the app route stays thin.
 */

import Link from 'next/link'
import { createClient } from '@/kernel/data/server'
import {
  countMembersWithAffiliations,
  loadIntroductionRequests,
  loadMemberAffiliations,
  loadMyOpenChecks,
  loadPeople,
  loadPeopleByIds,
  loadRoutesForPerson,
  resolveNetworkConfig,
  AffiliationProfileForm,
  ConnectionCheckPanel,
  IntroductionsBoard,
  PeopleDirectory,
} from '@/modules/network'
import {
  loadBoard,
  loadCandidates,
  loadInvitations,
  loadQuestions,
} from '@/modules/podcast-planning/domain/repository'
import { summariseQuestions } from '@/modules/podcast-planning/domain/question-summary'
import { resolvePlanningConfig } from '@/modules/podcast-planning/domain/config'
import { OpportunityBoard } from '@/modules/podcast-planning/ui/opportunity-board'
import { QuestionsScreen } from '@/modules/podcast-planning/ui/questions-screen'
import { CandidateDrawer } from '@/modules/podcast-planning/ui/candidate-drawer'
import { GuestImportButton } from '@/modules/podcast-planning/ui/guest-import-button'
import {
  IconBoard,
  IconHandshake,
  IconPeople,
  IconQuestion,
} from '@/modules/podcast-planning/ui/icons'

export type PlanningScreen = 'board' | 'questions' | 'people' | 'introductions'

const SCREENS: Array<{
  id: PlanningScreen
  label: string
  icon: (props: { className?: string }) => React.JSX.Element
}> = [
  { id: 'board', label: 'Board', icon: IconBoard },
  { id: 'questions', label: 'Questions', icon: IconQuestion },
  { id: 'people', label: 'People', icon: IconPeople },
  { id: 'introductions', label: 'Introductions', icon: IconHandshake },
]

export async function PlanningStrategyShell({
  screen = 'board',
  cardId,
  basePath,
}: {
  screen?: PlanningScreen
  cardId?: string
  basePath: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const nav = (
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1">
      {SCREENS.map((item) => {
        const Icon = item.icon
        const active = screen === item.id
        return (
          <Link
            key={item.id}
            href={`${basePath}&screen=${item.id}`}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <section className="space-y-4">
      {nav}

      {screen === 'board' && <BoardScreen basePath={basePath} cardId={cardId} />}
      {screen === 'questions' && <QuestionsTab />}
      {screen === 'people' && <PeopleTab profileId={user?.id ?? null} />}
      {screen === 'introductions' && <IntroductionsTab profileId={user?.id ?? null} />}
    </section>
  )
}

// ─── Board ───────────────────────────────────────────────────────────────────

async function BoardScreen({ basePath, cardId }: { basePath: string; cardId?: string }) {
  const [board, config] = await Promise.all([loadBoard(), resolvePlanningConfig()])
  const openCard = cardId ? board.cards.find((c) => c.candidate.id === cardId) : undefined

  const drawer = openCard
    ? await (async () => {
        const [routes, invitations] = await Promise.all([
          openCard.person ? loadRoutesForPerson(openCard.person.id) : Promise.resolve([]),
          loadInvitations(openCard.candidate.id),
        ])
        return (
          <CandidateDrawer
            candidate={openCard.candidate}
            question={openCard.question}
            person={openCard.person}
            routes={routes}
            invitations={invitations}
            config={config}
            openAskCount={board.openAskCount}
            closeHref={`${basePath}&screen=board`}
          />
        )
      })()
    : null

  return (
    <div className={drawer ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}>
      <div className="min-w-0">
        <OpportunityBoard board={board} config={config} basePath={basePath} />
      </div>
      {drawer}
    </div>
  )
}

// ─── Questions ───────────────────────────────────────────────────────────────

async function QuestionsTab() {
  const supabase = await createClient()
  const [questions, candidates, config, { data: profiles }] = await Promise.all([
    loadQuestions({ status: 'all' }),
    loadCandidates(),
    resolvePlanningConfig(),
    supabase.from('profiles').select('id, name, email').order('name'),
  ])

  const owners = (profiles ?? []).map((p) => ({ id: p.id, label: p.name ?? p.email ?? 'Unknown' }))
  return (
    <QuestionsScreen
      summaries={summariseQuestions(questions, candidates)}
      config={config}
      owners={owners}
    />
  )
}

// ─── People ──────────────────────────────────────────────────────────────────

async function PeopleTab({ profileId }: { profileId: string | null }) {
  const [people, declaredCount, myAffiliations, myChecks] = await Promise.all([
    loadPeople({ limit: 200 }),
    countMembersWithAffiliations(),
    profileId ? loadMemberAffiliations(profileId) : Promise.resolve([]),
    profileId ? loadMyOpenChecks(profileId) : Promise.resolve([]),
  ])

  const checkPeople = await loadPeopleByIds(myChecks.map((c) => c.personId))
  const personNames = Object.fromEntries([...checkPeople].map(([id, person]) => [id, person.fullName]))

  return (
    <div className="space-y-6">
      {myChecks.length > 0 && profileId && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-900">A quick question for you</h2>
          <ConnectionCheckPanel checks={myChecks} personNames={personNames} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">People ({people.length})</h2>
          <GuestImportButton />
        </div>
        <PeopleDirectory
          people={people}
          emptyHint="Nobody yet — import the past guests to start."
        />
      </section>

      {profileId && (
        <section className="space-y-3 border-t border-neutral-200 pt-6">
          <p className="text-xs text-neutral-500">
            {declaredCount} member{declaredCount === 1 ? ' has' : 's have'} filled in an affiliation
            profile.
          </p>
          <AffiliationProfileForm profileId={profileId} affiliations={myAffiliations} />
        </section>
      )}
    </div>
  )
}

// ─── Introductions ───────────────────────────────────────────────────────────

async function IntroductionsTab({ profileId }: { profileId: string | null }) {
  const supabase = await createClient()
  const [requests, config] = await Promise.all([
    loadIntroductionRequests({ contextType: 'podcast_candidate' }),
    resolveNetworkConfig(),
  ])

  const [{ data: profiles }, people] = await Promise.all([
    supabase.from('profiles').select('id, name, email'),
    loadPeopleByIds(requests.map((r) => r.personId)),
  ])

  const memberNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? 'A member']),
  )
  const personNames = Object.fromEntries([...people].map(([id, person]) => [id, person.fullName]))

  const mine = profileId ? requests.filter((r) => r.introducerProfileId === profileId && !r.response) : []

  return (
    <div className="space-y-6">
      {mine.length > 0 && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {mine.length} waiting on you — a no is completely fine.
        </p>
      )}
      <IntroductionsBoard
        requests={requests}
        memberNames={memberNames}
        personNames={personNames}
        config={config}
      />
    </div>
  )
}
