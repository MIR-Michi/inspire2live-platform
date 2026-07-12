/**
 * kernel/ai-client — the Anthropic client, model routing, key crypto and feature flag.
 *
 * The AI *client* is kernel; AI *features* (org feed, meeting summaries, intake
 * structuring) live in the `ai-features` component and other components.
 */
export * from '@/kernel/ai-client/client'
export * from '@/kernel/ai-client/models'
export * from '@/kernel/ai-client/crypto'
export * from '@/kernel/ai-client/feature-flag'
