import type { WhatsAppMediaAttachment } from '@/lib/comms-whatsapp-thread'

/**
 * Renders a WhatsApp media attachment (image / video / audio / document).
 * Shared by the WhatsApp workspace feed and any other surface that shows the
 * raw feed, so media rendering stays in one place.
 */
export function MediaAttachment({ media }: { media: WhatsAppMediaAttachment }) {
  if (media.status === 'pending') {
    return <p className="mt-2 text-xs italic text-neutral-400">Downloading {media.type}…</p>
  }
  if (media.status === 'failed') {
    return <p className="mt-2 text-xs text-red-600">{media.type} could not be downloaded.</p>
  }
  if (!media.url) return null

  if (media.type === 'image') {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.filename ?? 'WhatsApp image'}
          className="max-h-72 w-auto rounded-lg border border-neutral-200 object-contain"
        />
      </a>
    )
  }

  if (media.type === 'video') {
    return (
      <video controls preload="metadata" className="mt-2 max-h-72 w-full rounded-lg border border-neutral-200">
        <source src={media.url} type={media.mimeType ?? undefined} />
      </video>
    )
  }

  if (media.type === 'audio') {
    return <audio controls preload="metadata" src={media.url} className="mt-2 w-full" />
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-neutral-100"
    >
      📎 {media.filename ?? 'Download document'}
    </a>
  )
}
