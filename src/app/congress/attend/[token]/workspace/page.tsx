import type { Metadata } from 'next'
import { GuestWorkspace } from './guest-workspace'

export const metadata: Metadata = {
  title: 'Your conference workspace · Inspire2Live',
}

export default function WorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  return <WorkspaceLoader params={params} />
}

async function WorkspaceLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <GuestWorkspace token={token} />
}
