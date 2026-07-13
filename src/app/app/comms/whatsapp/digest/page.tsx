import { redirect } from 'next/navigation'

// The digest is merged into the WhatsApp workspace. Keep this route as a
// permanent redirect so old links / bookmarks still land on the right place.
export default function WhatsAppDigestRedirect() {
  redirect('/app/comms/whatsapp')
}
