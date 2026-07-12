/**
 * lib/ai/org-feed-catalog.ts
 *
 * Curated suggestions for the organization news-feed configuration wizard,
 * tailored to Inspire2Live (a patient-driven cancer organization). Pure data +
 * reconciliation helpers so the wizard, and unit tests, share one source of
 * truth. Free-text entries are always allowed on top of these suggestions.
 */

export type ThemeSuggestion = { label: string; description: string }
export type TopicCategory = { id: string; label: string; emoji: string; subtopics: string[] }
export type SourceSuggestion = { domain: string; label: string }

export const SUGGESTED_THEMES: ThemeSuggestion[] = [
  { label: 'Patient advocacy & voice', description: 'The patient perspective in research, care, and policy.' },
  { label: 'Research & scientific breakthroughs', description: 'New discoveries, studies, and translational science.' },
  { label: 'Treatment & clinical care', description: 'Therapies, guidelines, and how care is delivered.' },
  { label: 'Prevention & early detection', description: 'Screening, risk reduction, and catching cancer early.' },
  { label: 'Access, policy & affordability', description: 'Pricing, reimbursement, regulation, and equitable access.' },
  { label: 'Survivorship & quality of life', description: 'Living with and beyond cancer; supportive care.' },
  { label: 'Global health equity', description: 'Closing gaps across regions and populations.' },
  { label: 'Funding, grants & partnerships', description: 'Investment, philanthropy, and collaborations.' },
]

export const SUGGESTED_TOPIC_CATEGORIES: TopicCategory[] = [
  { id: 'precision', label: 'Precision oncology', emoji: '🧬', subtopics: ['Biomarkers', 'Targeted therapy', 'Genomic & tumor profiling', 'Companion diagnostics'] },
  { id: 'immuno', label: 'Immunotherapy', emoji: '🛡️', subtopics: ['Checkpoint inhibitors', 'CAR-T cell therapy', 'Cancer vaccines', 'Bispecific antibodies'] },
  { id: 'trials', label: 'Clinical trials', emoji: '🧪', subtopics: ['Trial results', 'Patient recruitment', 'Decentralized & trial access', 'Real-world evidence'] },
  { id: 'detection', label: 'Early detection & screening', emoji: '🔬', subtopics: ['Liquid biopsy', 'Multi-cancer early detection', 'Screening programs', 'Imaging & AI diagnostics'] },
  { id: 'ai', label: 'AI & data in oncology', emoji: '🤖', subtopics: ['Diagnostic AI', 'AI drug discovery', 'Predictive analytics', 'Health data sharing'] },
  { id: 'cancers', label: 'Specific cancers', emoji: '🎗️', subtopics: ['Breast', 'Lung', 'Prostate', 'Colorectal', 'Pancreatic', 'Pediatric', 'Rare cancers', 'Hematologic'] },
  { id: 'access', label: 'Access & affordability', emoji: '⚖️', subtopics: ['Drug pricing', 'Reimbursement & HTA', 'Generics & biosimilars', 'Low- & middle-income access'] },
  { id: 'supportive', label: 'Supportive & palliative care', emoji: '💚', subtopics: ['Quality of life', 'Symptom management', 'Mental health', 'Caregiver support'] },
  { id: 'prevention', label: 'Prevention & lifestyle', emoji: '🍎', subtopics: ['HPV & HBV vaccination', 'Tobacco & alcohol', 'Nutrition & exercise', 'Environmental risk'] },
]

export const SUGGESTED_SOURCES: SourceSuggestion[] = [
  { domain: 'nature.com', label: 'Nature' },
  { domain: 'thelancet.com', label: 'The Lancet' },
  { domain: 'nejm.org', label: 'NEJM' },
  { domain: 'jamanetwork.com', label: 'JAMA' },
  { domain: 'ascopubs.org', label: 'ASCO / JCO' },
  { domain: 'esmo.org', label: 'ESMO' },
  { domain: 'cancer.gov', label: 'NCI (cancer.gov)' },
  { domain: 'who.int', label: 'WHO' },
  { domain: 'statnews.com', label: 'STAT News' },
  { domain: 'fiercebiotech.com', label: 'Fierce Biotech' },
  { domain: 'endpts.com', label: 'Endpoints News' },
  { domain: 'clinicaltrials.gov', label: 'ClinicalTrials.gov' },
]

export const SUGGESTED_REGIONS: string[] = [
  'Global',
  'Europe',
  'Netherlands',
  'United Kingdom',
  'North America',
  'Africa',
  'Asia-Pacific',
  'Latin America',
]

/** Suggested individuals to monitor for public mentions (quick-add in the wizard). */
export const SUGGESTED_PEOPLE: string[] = ['Peter Kapitein']

export const CADENCE_OPTIONS: Array<{ value: 'daily' | 'weekly' | 'monthly'; label: string; description: string }> = [
  { value: 'daily', label: 'Daily', description: 'Fresh items every day — best for fast-moving topics.' },
  { value: 'weekly', label: 'Weekly', description: 'A weekly digest — a balanced default.' },
  { value: 'monthly', label: 'Monthly', description: 'A monthly roundup — lower volume.' },
]

/** All suggested topic strings (subtopics + category labels), for reconciliation. */
export const ALL_SUGGESTED_TOPICS: string[] = [
  ...SUGGESTED_TOPIC_CATEGORIES.map((c) => c.label),
  ...SUGGESTED_TOPIC_CATEGORIES.flatMap((c) => c.subtopics),
]

export const ALL_SUGGESTED_THEMES: string[] = SUGGESTED_THEMES.map((t) => t.label)
export const ALL_SUGGESTED_SOURCES: string[] = SUGGESTED_SOURCES.map((s) => s.domain)

/**
 * Split stored values into the ones that match a suggestion catalog (so their
 * checkboxes/chips can be pre-selected) and the leftover custom entries. Used
 * to round-trip an existing config back into the wizard for editing, including
 * configs created with the old free-text form.
 */
export function splitKnownAndCustom(values: string[], known: string[]): { known: string[]; custom: string[] } {
  const knownByLower = new Map(known.map((k) => [k.toLowerCase(), k]))
  const matched: string[] = []
  const custom: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const value = raw.trim()
    const key = value.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const canonical = knownByLower.get(key)
    if (canonical) matched.push(canonical)
    else custom.push(value)
  }
  return { known: matched, custom }
}
