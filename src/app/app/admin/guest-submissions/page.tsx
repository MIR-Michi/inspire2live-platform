import { redirect } from 'next/navigation'

export default function GuestSubmissionsRedirectPage() {
  redirect('/app/comms/conferences/submissions')
}
