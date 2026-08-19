/**
 * publishing — component manifest (see docs/MODULAR_COMPONENT_ARCHITECTURE.md §4).
 *
 * The generic half of the Publishing space (ADR-0014): turn an already-resolved
 * `PublishableSource` into channel-shaped copy, keep it under human review, and
 * hand the approved text to the content calendar. It knows nothing about campus
 * sessions or any other source owner — providers meet it through
 * `src/modules/publishing-registry.ts`. A channel is data (`domain/channels.ts`),
 * keyed by the existing `CalendarChannel` vocabulary; there is no `linkedin`
 * module.
 *
 * Every tunable below is operator config (ADR-0010) — except one, deliberately:
 * whether a human must approve before handover is fixed in the domain layer
 * (`domain/rights.ts`) and is not a setting (ADR-0014 §8).
 */

import { defineManifest } from '@/kernel/manifest'

export const manifest = defineManifest({
  id: 'publishing',
  version: '1.0.0',
  title: 'Publishing',
  summary:
    'Turns a platform record or an uploaded screenshot into channel-ready copy, keeps it under human review, and hands the approved text to the content calendar.',
  surface: 'internal',
  data: {
    schema: 'publishing',
    tablePrefix: 'publishing_',
    tables: ['publishing_drafts', 'publishing_sources'],
    migrations: ['00173'],
  },
  provides: {
    api: [
      // channels (data, pure)
      'CHANNEL_PROFILES',
      'channelProfile',
      'channelBudget',
      'isChannelEnabled',
      // gates (pure)
      'sourceReadiness',
      'validateChannelPostPayload',
      'rightsAllowHandover',
      'handoverBlockReason',
      // ad-hoc source
      'createAdhocSource',
      'adhocSourceProvider',
      'validateAdhocUpload',
      // drafting + lifecycle
      'generateDrafts',
      'loadDrafts',
      'loadRecentDrafts',
      'loadDraft',
      'editDraft',
      'approveDraft',
      'dismissDraft',
      'handOverApprovedDraft',
      // configuration
      'resolvePublishingConfig',
    ],
    events: ['publishing.draft.approved'],
    ui: ['PublishingShell', 'PublishFromHere'],
    sources: ['adhoc'],
    settingsPanel: true,
  },
  dependsOn: {
    kernel: ['identity', 'rbac', 'ai-client', 'data', 'settings', 'ui', 'publishing'],
    // One direction only: approved copy becomes a calendar entry through the
    // calendar owner's own action. `publishing` imports no source owner.
    components: ['content@^1'],
  },
  config: {
    variantsPerRun: {
      type: 'number',
      label: 'Variants per run',
      description:
        'How many alternative drafts one generation produces. More choice helps a reviewer but triples the reading — tune it against real use, not a guess.',
      default: 3,
      min: 1,
      max: 5,
      step: 1,
    },
    brandVoice: {
      type: 'text',
      label: 'Brand voice',
      description:
        'The one place the organisation’s voice is written down. Folded into every drafting prompt.',
      default:
        'Warm, direct and factual. We write as patient advocates: hopeful but never overpromising, always grounded in what actually happened.',
    },
    bannedPhrases: {
      type: 'text',
      label: 'Banned phrases',
      description:
        'Comma-separated house-style bans (hype words, curative claims). The drafter must not use them.',
      default: 'breakthrough, game-changer, revolutionary, miracle cure, cure for cancer',
    },
    hashtagPolicy: {
      type: 'enum',
      label: 'Hashtag policy',
      description: '“suggest” lets the model propose; “fixed” always appends the fixed set; “none” forbids hashtags.',
      options: ['none', 'suggest', 'fixed'],
      default: 'suggest',
    },
    fixedHashtags: {
      type: 'string',
      label: 'Fixed hashtags',
      description: 'Used when the policy is “fixed” (space- or comma-separated).',
      default: '',
    },
    includeSourceLink: {
      type: 'boolean',
      label: 'Include source link',
      description: 'Add the source’s public URL to the draft when one exists.',
      default: true,
    },
    minimumSourceCharacters: {
      type: 'number',
      label: 'Readiness threshold (characters)',
      description:
        'Below this much source material the space refuses to draft rather than invent (the readiness gate).',
      default: 120,
      min: 0,
      max: 2000,
      step: 10,
    },
    maxUploadMegabytes: {
      type: 'number',
      label: 'Upload ceiling (MB)',
      description: 'Largest screenshot an ad-hoc source may carry.',
      default: 10,
      min: 1,
      max: 25,
      step: 1,
    },
    staleDraftBehaviour: {
      type: 'enum',
      label: 'Stale source behaviour',
      description:
        'What happens when a linked source changed after the draft was generated: warn the reviewer, or block approval until regenerated.',
      options: ['warn', 'block'],
      default: 'warn',
    },
  },
  featureFlag: 'comms_team',
  personas: ['communications-coordinator'],
  roles: { read: ['comms_team', 'admin'], write: ['comms_team', 'admin'] },
  requirements: ['REQ-PUB-001', 'REQ-PUB-002', 'REQ-PUB-003', 'REQ-PUB-004', 'REQ-PUB-005'],
  operations: ['draft-post'],
})

export default manifest
