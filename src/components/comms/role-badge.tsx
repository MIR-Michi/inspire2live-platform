import { getRoleBadgeColor, getRoleLabel } from '@/lib/role-access'

/** Small pill showing a person's platform role (e.g. "Communications", "Board"). */
export function RoleBadge({
  role,
  className = '',
}: {
  role: string | null | undefined
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-transparent px-1.5 py-0.5 text-[10px] font-semibold ${getRoleBadgeColor(role)} ${className}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}
