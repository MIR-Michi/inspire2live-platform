import type { Metadata } from 'next'
import { GuestAttendanceForm } from './guest-attendance-form'

export const metadata: Metadata = {
  title: 'Report conference attendance · Inspire2Live',
  description: 'Let us know which medical conference you are attending.',
}

export default function CongressGuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ add?: string }>
}) {
  return <GuestAttendanceFormLoader params={params} searchParams={searchParams} />
}

async function GuestAttendanceFormLoader({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ add?: string }>
}) {
  const { token } = await params
  const sp = (await searchParams) ?? {}
  // "?add=1" = a returning guest adding another conference: don't bounce them
  // to their existing workspace, show a fresh form instead.
  const addMode = sp.add === '1' || sp.add === 'true'
  return <GuestAttendanceForm token={token} addMode={addMode} />
}
