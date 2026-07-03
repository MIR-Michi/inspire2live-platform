/**
 * kernel/shell — navigation + app layout.
 *
 * Nav access rules live in kernel/rbac (role-access); the layout chrome lives in
 * src/components/layouts for now. Stage 3 composes the shell from enabled
 * component manifests. This barrel is the stable import surface.
 */
export * from '@/kernel/rbac/role-access'
