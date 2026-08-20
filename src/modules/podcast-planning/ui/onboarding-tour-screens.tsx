/**
 * podcast-planning/ui/onboarding-tour-screens.tsx — the real screens, on stage.
 *
 * The tour shows the actual Questions screen, Board, candidate drawer, route
 * explorer, People list and Radar review — not a redrawing of them — so what it
 * teaches is what the user is about to use, and a UI change lands in the tour
 * for free.
 *
 * They are rendered **here, on the server**, and handed to the client player as
 * props. That is not decoration: `CandidateDrawer` and `RouteExplorer` reach
 * `network`'s public API, which pulls server-only modules, so importing them
 * from the `'use client'` player would break the build. Rendering them as an
 * RSC payload keeps the boundary honest and the client bundle small.
 *
 * The player makes the whole stage `inert`, which matters more than usual here:
 * these are live components wired to real server actions, and a stray click on
 * a demo card must not move anything.
 */

import { PeopleDirectory, RouteExplorer } from '@/modules/network'
import { CandidateDrawer } from '@/modules/podcast-planning/ui/candidate-drawer'
import { OpportunityBoard } from '@/modules/podcast-planning/ui/opportunity-board'
import { QuestionsScreen } from '@/modules/podcast-planning/ui/questions-screen'
import { RadarReview } from '@/modules/podcast-planning/ui/radar-screen'
import { TourLauncher } from '@/modules/podcast-planning/ui/onboarding-tour'
import {
  TOUR_BOARD,
  TOUR_CONFIG,
  TOUR_DRAWER,
  TOUR_OWNERS,
  TOUR_PEOPLE,
  TOUR_RADAR,
  TOUR_SUMMARIES,
} from '@/modules/podcast-planning/ui/onboarding-tour-fixture'

/** The button in the space header, and the player it opens. */
export function PodcastOnboardingTour() {
  return (
    <TourLauncher
      screens={{
        questions: (
          <QuestionsScreen summaries={TOUR_SUMMARIES} config={TOUR_CONFIG} owners={TOUR_OWNERS} />
        ),
        board: <OpportunityBoard board={TOUR_BOARD} config={TOUR_CONFIG} basePath="#" />,
        drawer: (
          <CandidateDrawer
            candidate={TOUR_DRAWER.candidate}
            question={TOUR_DRAWER.question}
            person={TOUR_DRAWER.person}
            routes={TOUR_DRAWER.routes}
            invitations={TOUR_DRAWER.invitations}
            config={TOUR_CONFIG}
            openAskCount={TOUR_DRAWER.openAskCount}
            closeHref="#"
          />
        ),
        routes: (
          <RouteExplorer
            personId={TOUR_DRAWER.person?.id ?? ''}
            personName={TOUR_DRAWER.person?.fullName ?? ''}
            routes={TOUR_DRAWER.routes}
            contextType="podcast_candidate"
            contextId={TOUR_DRAWER.candidate.id}
            contextSummary={`an episode on ${TOUR_DRAWER.question.question}`}
          />
        ),
        people: <PeopleDirectory people={TOUR_PEOPLE} />,
        radar: <RadarReview items={TOUR_RADAR.items} status={TOUR_RADAR.status} />,
      }}
    />
  )
}
