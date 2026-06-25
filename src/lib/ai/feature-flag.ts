import 'server-only'

export class AiFeatureDisabledError extends Error {
  constructor() {
    super('AI features are disabled for this environment')
    this.name = 'AiFeatureDisabledError'
  }
}

export function isAiEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FEATURE_AI
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'
}

export function requireAiEnabled(): void {
  if (!isAiEnabled()) throw new AiFeatureDisabledError()
}
