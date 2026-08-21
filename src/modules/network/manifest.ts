/**
 * network — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * The reusable half of the Podcast Opportunity Engine (ADR-0013). Nothing in
 * this component knows what a podcast is: it holds a people directory, declared
 * and public affiliations, a connection graph, the cheap map question, and the
 * introduction request. Any organisation that has to reach people it does not
 * yet know needs exactly this, which is why it is its own component rather than
 * a folder inside the podcast planner.
 *
 * Extractability is the acid test (ADR-0009 §3): this manifest depends only on
 * the kernel and the identity spine (`contacts@^1`), and its introduction
 * requests carry a generic `context_type`/`context_id` rather than a foreign key
 * to whatever asked for them.
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: 'network',
  version: '1.0.0',
  title: 'Relationship Network',
  summary:
    'Finds the shortest warm route to a person you do not yet know: a people directory, opt-in member affiliations, a connection graph, a five-second "do you know them" check, and introduction requests that never wear an introducer out.',
  surface: 'internal',
  data: {
    schema: 'network',
    tablePrefix: 'network_',
    tables: [
      'network_people',
      'network_person_affiliations',
      'network_member_affiliations',
      'network_connections',
      'network_connection_checks',
      'network_introduction_requests',
    ],
    readViews: ['network_people_public'],
    migrations: ['00171'],
  },
  provides: {
    api: [
      // people
      'loadPeople',
      'loadPerson',
      'loadPeopleByIds',
      'createPerson',
      'updatePerson',
      'upsertPeopleByName',
      'recordObjection',
      'canDeletePerson',
      'deletePerson',
      'addPersonToCrm',
      'purgeInactivePeople',
      // affiliations
      'loadPersonAffiliations',
      'loadMemberAffiliations',
      'countMembersWithAffiliations',
      'declareMemberAffiliation',
      'revokeMemberAffiliation',
      'setMemberAffiliationVisibility',
      // the graph
      'loadRoutesForPerson',
      'refreshSuggestedConnections',
      // the map question
      'loadConnectionChecks',
      'loadMyOpenChecks',
      'askConnectionCheck',
      'answerConnectionCheck',
      // the favour
      'loadIntroductionRequests',
      'loadIntroducerHistory',
      'canRequestIntroduction',
      'summariseIntroducerLoad',
      'requestIntroduction',
      'respondToIntroduction',
      'recordIntroductionSent',
      'recordIntroductionOutcome',
      'buildIntroducerPackage',
    ],
    events: ['network.connection.confirmed', 'network.introduction.requested'],
    ui: ['PeopleDirectory', 'IntroductionsBoard', 'RouteExplorer', 'AffiliationProfileForm', 'ConnectionCheckPanel'],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'data', 'settings'],
    // The identity spine only (ADR-0007): a directory person may be linked to a
    // CRM contact. No other component may be depended on, by design.
    components: ['contacts@^1'],
  },
  // Operator-tunable. These are the numbers the concept proposes as *starting*
  // values to be calibrated against real outcomes — so they are settings, not
  // constants (ADR-0013 §3).
  config: {
    minRouteStrength: {
      type: 'number',
      label: 'Minimum route strength',
      description:
        'Routes weaker than this are never offered. Suggesting a weak route spends an introducer’s goodwill on a request that was never going to work.',
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
    },
    maxRoutesShown: {
      type: 'number',
      label: 'Routes shown per person',
      description: 'How many of the strongest routes to show on a card.',
      default: 3,
      min: 1,
      max: 10,
      step: 1,
    },
    twoStepDiscount: {
      type: 'number',
      label: 'Two-step route multiplier',
      description:
        'Applied after multiplying the two connections, because asking somebody to ask somebody else really does cost more. 0.85 = the 15 % discount.',
      default: 0.85,
      min: 0.1,
      max: 1,
      step: 0.05,
    },
    introducerCooldownDays: {
      type: 'number',
      label: 'Days between favour requests',
      description:
        'Nobody receives more than one introduction request per this many days. The cheap “do you know them” check is deliberately not throttled.',
      default: 14,
      min: 1,
      max: 90,
      step: 1,
    },
    retentionInactiveMonths: {
      type: 'number',
      label: 'Delete inactive people after (months)',
      description:
        'These records describe people who never signed up. A record nobody has touched in this long is deleted — except members, CRM contacts, anyone still on a live card, and anyone who objected (their row is the objection).',
      default: 18,
      min: 3,
      max: 120,
      step: 1,
    },
  },
  featureFlag: 'comms_team',
  personas: ['communications-coordinator', 'patient-advocate'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: ['REQ-NET-001', 'REQ-NET-002', 'REQ-NET-003', 'REQ-NET-004'],
  operations: [],
})

export default manifest
