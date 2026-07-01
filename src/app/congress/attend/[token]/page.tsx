import type { Metadata } from 'next'
import { GuestAttendanceForm } from './guest-attendance-form'

export const metadata: Metadata = {
  title: 'Report conference attendance · Inspire2Live',
  description: 'Let us know which medical conference you are attending.',
}

export default function CongressGuestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  return <GuestAttendanceFormLoader params={params} />
}

async function GuestAttendanceFormLoader({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <GuestAttendanceForm token={token} />
}
