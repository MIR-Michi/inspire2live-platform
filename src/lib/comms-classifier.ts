import { isPeterKapiteinSignal, normalizeSignalText } from '@/lib/comms-routing'
import type { IntakeContentType } from '@/lib/comms-workflow'

export type IntakeClassifierConfidence = 'low' | 'medium' | 'high'

export type ClassifierReason = {
  ruleId: string
  label: string
  evidence: string
  effect: 'type' | 'confidence' | 'founder_signal'
}

export type PersistedClassifierReason = {
  ruleId: string
  label: string
  evidence: string
  effect: 'type' | 'confidence' | 'founder_signal'
}

export type ClassifierRule = {
  id: string
  name: string
  description?: string | null
  matchField: 'sender_name' | 'raw_content' | 'source_url'
  matchType: 'contains' | 'exact' | 'regex'
  pattern: string
  suggestedContentType: IntakeContentType
  suggestedConfidence: IntakeClassifierConfidence
  marksPeter: boolean
  priority: number
}

type IntakeClassifierInput = {
  senderName: string
  rawContent: string
  sourceUrl?: string | null
  attachedMediaRef?: string | null
}

type MatchedRule = {
  ruleId: string
  label: string
  evidence: string
  effect: 'type' | 'confidence' | 'founder_signal'
  matchField: ClassifierRule['matchField']
  matchType: ClassifierRule['matchType']
  suggestedContentType?: IntakeContentType
  suggestedConfidence?: IntakeClassifierConfidence
  marksPeter?: boolean
  weight: number
}

export type ClassifierResult = {
  contentType: IntakeContentType
  confidence: IntakeClassifierConfidence
  isPeterKapitein: boolean
  reasoning: PersistedClassifierReason[]
  matchedRuleIds: string[]
  classifierVersion: string
}

export const COMMS_CLASSIFIER_VERSION = 'sprint-05-rules-v1'

const BUILT_IN_RULES: ClassifierRule[] = [
  {
    id: 'builtin:founder-sender',
    name: 'Peter sender exact match',
    description: 'Treat direct Peter messages as founder signals.',
    matchField: 'sender_name',
    matchType: 'exact',
    pattern: 'peter kapitein',
    suggestedContentType: 'member_intro',
    suggestedConfidence: 'high',
    marksPeter: true,
    priority: 300,
  },
  {
    id: 'builtin:event-keywords',
    name: 'Event keywords',
    description: 'Mentions of congresses, workshops, conferences, or assemblies map to events.',
    matchField: 'raw_content',
    matchType: 'regex',
    pattern: '\\b(congress|conference|workshop|summit|symposium|general assembly|meeting)\\b',
    suggestedContentType: 'event_report',
    suggestedConfidence: 'high',
    marksPeter: false,
    priority: 250,
  },
  {
    id: 'builtin:media-keywords',
    name: 'Media request keywords',
    description: 'Photo, video, recording, slides, and SharePoint requests map to media.',
    matchField: 'raw_content',
    matchType: 'regex',
    pattern: '\\b(photo|photos|video|videos|recording|recordings|slides|sharepoint|asset|media)\\b',
    suggestedContentType: 'media_request',
    suggestedConfidence: 'high',
    marksPeter: false,
    priority: 240,
  },
  {
    id: 'builtin:member-keywords',
    name: 'Member introduction keywords',
    description: 'Welcome, joins, or introductions map to campus members.',
    matchField: 'raw_content',
    matchType: 'regex',
    pattern: '\\b(welcome|joins|joined|introduction|this is|i am|new member)\\b',
    suggestedContentType: 'member_intro',
    suggestedConfidence: 'medium',
    marksPeter: false,
    priority: 220,
  },
  {
    id: 'builtin:article-keywords',
    name: 'Article share keywords',
    description: 'Article, study, paper, and newsletter language map to article shares.',
    matchField: 'raw_content',
    matchType: 'regex',
    pattern: '\\b(article|study|paper|newsletter|news)\\b',
    suggestedContentType: 'article_share',
    suggestedConfidence: 'medium',
    marksPeter: false,
    priority: 230,
  },
  {
    id: 'builtin:initiative-keywords',
    name: 'Initiative update keywords',
    description: 'Milestones, launches, and progress updates map to initiative updates.',
    matchField: 'raw_content',
    matchType: 'regex',
    pattern: '\\b(initiative|milestone|launch|update|progress|kickoff|pilot)\\b',
    suggestedContentType: 'initiative_update',
    suggestedConfidence: 'medium',
    marksPeter: false,
    priority: 200,
  },
  {
    id: 'builtin:source-url-article',
    name: 'External article URL',
    description: 'External source links usually indicate article shares.',
    matchField: 'source_url',
    matchType: 'regex',
    pattern: 'https?://',
    suggestedContentType: 'article_share',
    suggestedConfidence: 'medium',
    marksPeter: false,
    priority: 210,
  },
]

function evaluateRule(rule: ClassifierRule, input: IntakeClassifierInput): MatchedRule | null {
  const fieldValue =
    rule.matchField === 'sender_name'
      ? input.senderName
      : rule.matchField === 'source_url'
        ? input.sourceUrl ?? ''
        : input.rawContent

  if (!fieldValue) return null

  const normalizedField = normalizeSignalText(fieldValue)
  const normalizedPattern = normalizeSignalText(rule.pattern)

  let matched = false
  switch (rule.matchType) {
    case 'contains':
      matched = normalizedField.includes(normalizedPattern)
      break
    case 'exact':
      matched = normalizedField === normalizedPattern
      break
    case 'regex':
      matched = new RegExp(rule.pattern, 'i').test(fieldValue)
      break
  }

  if (!matched) return null

  return {
    ruleId: rule.id,
    label: rule.name,
    evidence: fieldValue.slice(0, 140),
    effect: rule.marksPeter ? 'founder_signal' : 'type',
    matchField: rule.matchField,
    matchType: rule.matchType,
    suggestedContentType: rule.suggestedContentType,
    suggestedConfidence: rule.suggestedConfidence,
    marksPeter: rule.marksPeter,
    weight: rule.priority,
  }
}

function getDefaultType(input: IntakeClassifierInput): IntakeContentType {
  if (input.attachedMediaRef) return 'media_request'
  if (input.sourceUrl) return 'article_share'
  return 'noise'
}

function toConfidence(weight: number, explicitHigh: boolean): IntakeClassifierConfidence {
  if (explicitHigh || weight >= 240) return 'high'
  if (weight >= 180) return 'medium'
  return 'low'
}

export function serializeClassifierReasons(reasons: PersistedClassifierReason[]) {
  return reasons
}

export function classifyIntakeItem(
  input: IntakeClassifierInput,
  externalRules: ClassifierRule[] = []
): ClassifierResult {
  const rules = [...externalRules, ...BUILT_IN_RULES].sort((a, b) => b.priority - a.priority)
  const matches = rules
    .map((rule) => evaluateRule(rule, input))
    .filter((match): match is MatchedRule => Boolean(match))

  const peterSignal = isPeterKapiteinSignal(input.senderName) || matches.some((match) => match.marksPeter)
  const exactSenderOverride = matches.find(
    (match) => match.matchField === 'sender_name' && match.matchType === 'exact' && match.suggestedContentType
  )

  const scores = new Map<IntakeContentType, number>()
  for (const match of matches) {
    if (!match.suggestedContentType) continue
    scores.set(match.suggestedContentType, (scores.get(match.suggestedContentType) ?? 0) + match.weight)
  }

  const sortedTypes = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  const [winningType, winningWeight] = exactSenderOverride
    ? [exactSenderOverride.suggestedContentType, exactSenderOverride.weight]
    : (sortedTypes[0] ?? [getDefaultType(input), 0])
  const contentType = winningType as IntakeContentType

  const confidence = exactSenderOverride
    ? 'high'
    : peterSignal
    ? 'high'
    : toConfidence(
        winningWeight,
        matches.some((match) => match.suggestedConfidence === 'high')
      )

  const reasons: PersistedClassifierReason[] = matches.map((match) => ({
    ruleId: match.ruleId,
    label: match.label,
    evidence: match.evidence,
    effect: match.effect,
  }))

  if (reasons.length === 0) {
    reasons.push({
      ruleId: 'builtin:fallback',
      label: 'Fallback classification',
      evidence: input.sourceUrl ? 'Source URL present' : 'No explicit rule matched',
      effect: 'type',
    })
  }

  if (peterSignal && !reasons.some((reason) => reason.effect === 'founder_signal')) {
    reasons.unshift({
      ruleId: 'builtin:founder-normalizer',
      label: 'Founder alias normalization',
      evidence: input.senderName,
      effect: 'founder_signal',
    })
  }

  return {
    contentType,
    confidence,
    isPeterKapitein: peterSignal,
    reasoning: reasons,
    matchedRuleIds: reasons.map((reason) => reason.ruleId),
    classifierVersion: COMMS_CLASSIFIER_VERSION,
  }
}

export function parseSourceUrl(rawContent: string) {
  const match = rawContent.match(/https?:\/\/[^\s]+/i)
  return match?.[0] ?? null
}

export function toClassifierRules(
  rows: Array<{
    id: string
    rule_name: string
    description: string | null
    match_field: string
    match_type: string
    pattern: string
    suggested_content_type: string
    suggested_confidence: string
    marks_peter: boolean
    priority: number
  }>
): ClassifierRule[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.rule_name,
    description: row.description,
    matchField: row.match_field as ClassifierRule['matchField'],
    matchType: row.match_type as ClassifierRule['matchType'],
    pattern: row.pattern,
    suggestedContentType: row.suggested_content_type as IntakeContentType,
    suggestedConfidence: row.suggested_confidence as IntakeClassifierConfidence,
    marksPeter: row.marks_peter,
    priority: row.priority,
  }))
}
