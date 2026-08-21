import { NextResponse } from 'next/server'
import { denyUnauthorizedCron } from '@/kernel/identity'
import { purgeInactivePeople, resolveRetentionMonths } from '@/modules/network'
import {
  anonymiseClosedCards,
  asksForRehearsal,
  planningAdminDb,
  resolveRadarConfig,
} from '@/modules/podcast-planning'

export const maxDuration = 120

/**
 * The retention job for the podcast engine.
 *
 * Two promises, kept by two components, run together because they are one
 * commitment as far as anybody outside the code is concerned: an untouched
 * person record is deleted after eighteen months, and a closed card is
 * anonymised after twelve. Each half runs through its owning component's public
 * API — `network` decides what deleting a person means, `podcast-planning`
 * decides what survives on a card (ADR-0009 §9 rule 3).
 *
 * One half failing must not stop the other: they are independent obligations,
 * and a purge that is skipped because an unrelated update errored is a purge
 * that quietly stops happening.
 *
 * `?dryRun` reports what would be deleted without deleting it — worth having for
 * the first real run, when the answer to "how many?" is genuinely unknown. What
 * counts as asking is `asksForRehearsal`, next to the job it protects.
 */
export async function GET(request: Request) {
  const denied = denyUnauthorizedCron(request)
  if (denied) return denied

  const dryRun = asksForRehearsal(new URL(request.url).searchParams.get('dryRun'))
  const results: Record<string, unknown> = { dryRun }
  let failed = false

  try {
    const months = await resolveRetentionMonths()
    results.people = await purgeInactivePeople({ months, dryRun })
  } catch (error) {
    failed = true
    results.people = { error: error instanceof Error ? error.message : 'Purge failed.' }
    console.error('[retention] purging inactive people failed:', error)
  }

  try {
    const config = await resolveRadarConfig({ background: true })
    results.cards = await anonymiseClosedCards(await planningAdminDb(), {
      months: config.retentionClosedCardMonths,
      dryRun,
    })
  } catch (error) {
    failed = true
    results.cards = { error: error instanceof Error ? error.message : 'Anonymisation failed.' }
    console.error('[retention] anonymising closed cards failed:', error)
  }

  return NextResponse.json({ ok: !failed, ...results }, { status: failed ? 500 : 200 })
}
