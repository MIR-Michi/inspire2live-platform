import { MEDIA_RIGHTS_STATUS_META, type MediaRightsStatus } from '@/lib/comms-media'

export function RightsStatusBadge({ status }: { status: string }) {
  const meta =
    MEDIA_RIGHTS_STATUS_META[status as MediaRightsStatus] ?? MEDIA_RIGHTS_STATUS_META.internal_only

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.tone}`}>
      {meta.label}
    </span>
  )
}
