import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole , isPlatformAdmin} from '@/lib/role-access'
import { loadAdminPermissionsData } from '@/lib/admin-permissions-data'
import { loadAdminRoleDefaultsData } from '@/lib/admin-role-defaults-data'
import { PermissionsWorkspaceShell } from '@/components/admin/permissions-workspace-shell'

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: 'Permission Management · Admin' }

export default async function AdminPermissionsPage() {
  /* ── Auth & admin gate ────────────────────────────────────────────────────── */
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (err) {
    return <DiagnosticError stage="createClient" error={err} />
  }

  let userId: string
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      console.error('[permissions page] auth failed', { message: authError?.message ?? 'no user' })
      redirect('/login')
    }
    userId = authData.user.id
  } catch (err) {
    // redirect() throws a special NEXT_REDIRECT — re-throw it
    if (isNextRedirect(err)) throw err
    return <DiagnosticError stage="auth.getUser" error={err} />
  }

  let myRole: string
  try {
    const { data: me, error: meError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (meError) {
      console.error('[permissions page] failed to load current profile', {
        userId,
        message: meError.message,
        code: (meError as { code?: string }).code,
      })
      return (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Permission Management</h1>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-700">⚠️ Unable to validate admin access</p>
            <p className="mt-1 font-mono text-xs text-red-600">current profile: {meError.message}</p>
            <p className="mt-3 text-xs text-red-500">
              This is usually caused by a profile RLS issue, missing profile row, or an auth/session mismatch.
              Check Vercel function logs for <code className="font-mono">[permissions page]</code> entries.
            </p>
          </div>
        </div>
      )
    }

    myRole = normalizeRole(me?.role)
  } catch (err) {
    if (isNextRedirect(err)) throw err
    return <DiagnosticError stage="profiles.select" error={err} />
  }

  // redirect() OUTSIDE try/catch — Next.js requirement
  if (!isPlatformAdmin(myRole)) redirect('/app/dashboard')

  /* ── Data loading ─────────────────────────────────────────────────────────── */
  let users: Awaited<ReturnType<typeof loadAdminPermissionsData>>['users'] = []
  let overrideCount = 0
  let pageError: string | null = null
  let roleDefaults: Awaited<ReturnType<typeof loadAdminRoleDefaultsData>>['roleDefaults'] | null = null

  try {
    const result = await loadAdminPermissionsData(supabase)
    const roleDefaultsResult = await loadAdminRoleDefaultsData(supabase)
    users = result.users
    overrideCount = result.overrideCount
    roleDefaults = roleDefaultsResult.roleDefaults
    pageError = [result.pageError, roleDefaultsResult.warning].filter(Boolean).join(' | ') || null
  } catch (err) {
    return <DiagnosticError stage="loadAdminPermissionsData" error={err} />
  }

  if (pageError) {
    console.error('[permissions page] data load issue', { message: pageError })
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */
  try {
    return renderPage({ users, overrideCount, pageError, roleDefaults: roleDefaults! })
  } catch (err) {
    return <DiagnosticError stage="renderPage" error={err} />
  }
}

// ─── Render helper (extracted so we can try/catch the JSX) ────────────────────

type PageData = {
  users: Awaited<ReturnType<typeof loadAdminPermissionsData>>['users']
  overrideCount: number
  pageError: string | null
  roleDefaults: Awaited<ReturnType<typeof loadAdminRoleDefaultsData>>['roleDefaults']
}

function renderPage({ users, overrideCount, pageError, roleDefaults }: PageData) {
  if (pageError && users.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Permission Management</h1>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">⚠️ Page failed to load</p>
          <p className="mt-1 font-mono text-xs text-red-600">{pageError}</p>
          <p className="mt-3 text-xs text-red-500">
            Check Vercel function logs for the full stack trace.
            Common causes: RLS policy mismatch (your DB role must be exactly &ldquo;PlatformAdmin&rdquo;),
            or a missing/unapplied database migration.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PermissionsWorkspaceShell
      users={users}
      overrideCount={overrideCount}
      pageError={pageError}
      roleDefaults={roleDefaults}
    />
  )
}

/**
 * Diagnostic error component — shows the actual error message on the page
 * instead of Next.js's generic production error.
 * Only visible to PlatformAdmin users (this route is admin-only).
 */
function DiagnosticError({ stage, error }: { stage: string; error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[permissions page] CRASH at stage="${stage}"`, error)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Permission Management</h1>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
        <p className="text-sm font-semibold text-red-700">
          ⚠️ Server Component crashed at stage: <code className="font-mono">{stage}</code>
        </p>
        <div className="rounded-lg bg-white border border-red-100 px-4 py-3">
          <p className="font-mono text-xs font-medium text-red-600 break-all">
            {message}
          </p>
        </div>
        {stack && (
          <details className="text-xs">
            <summary className="cursor-pointer text-red-500 hover:text-red-700">Stack trace</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-neutral-900 p-3 text-[10px] text-green-400">
              {stack}
            </pre>
          </details>
        )}
        <p className="text-xs text-red-500">
          This diagnostic is only visible to PlatformAdmin users.
          Check Vercel function logs for <code className="font-mono">[permissions page] CRASH</code>.
        </p>
        <a
          href="/app/admin/users"
          className="inline-block text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
        >
          ← Back to User Management
        </a>
      </div>
    </div>
  )
}

/** Detect Next.js redirect() "errors" so we re-throw them */
function isNextRedirect(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'digest' in err) {
    const digest = (err as { digest: string }).digest
    return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
  }
  return false
}