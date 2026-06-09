'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS } from '@/lib/role-access'
import { getAuthCallbackUrl } from '@/lib/auth-redirect-url'
import { setUserStatus, deleteUser, type AccountStatus } from '@/app/app/admin/users/actions'

/** Derived from the canonical ROLE_LABELS so labels never diverge from the source of truth. */
const PLATFORM_ROLE_OPTIONS = (Object.entries(ROLE_LABELS) as [string, string][]).map(
  ([value, label]) => ({ value, label })
)

const CONGRESS_ROLE_OPTIONS = [
  'Congress Lead',
  'Scientific Lead',
  'Ops Lead',
  'Sponsor Lead',
  'Comms Lead',
  'Finance',
  'Compliance Reviewer',
  'Contributor',
  'Observer',
] as const

/* ─── Generic placeholder button (replaces alert-only buttons) ─────────── */
export function PlaceholderButton({
  label,
  message,
  icon,
  variant = 'primary',
}: {
  label: string
  message: string
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const [showToast, setShowToast] = useState(false)

  const base =
    variant === 'primary'
      ? 'inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors'
      : 'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors'

  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowToast(true)
          setTimeout(() => setShowToast(false), 3000)
        }}
        className={base}
      >
        {icon}
        {label}
      </button>
      {showToast && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 shadow-lg">
          {message}
        </div>
      )}
    </div>
  )
}

/* ─── Plus icon reused by many buttons ─────────────────────────────────── */
export function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

export function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

export function InviteIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  )
}

/* ─── Vote button for congress topics ──────────────────────────────────── */
export function VoteButton({ votes }: { votes: number }) {
  const [count, setCount] = useState(votes)
  const [voted, setVoted] = useState(false)

  return (
    <button
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border transition-colors ${
        voted
          ? 'border-orange-400 bg-orange-50 text-orange-700'
          : 'border-neutral-200 bg-neutral-50 hover:bg-orange-50 hover:border-orange-300'
      }`}
      onClick={() => {
        if (!voted) {
          setCount(count + 1)
          setVoted(true)
        } else {
          setCount(count - 1)
          setVoted(false)
        }
      }}
    >
      <svg className={`h-4 w-4 ${voted ? 'text-orange-600' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
      <span className="text-sm font-bold text-neutral-700">{count}</span>
    </button>
  )
}

/* ─── Edit Role button (admin users page) ──────────────────────────────── */
export function EditRoleButton({ userName, userId, currentRole }: { userName: string; userId: string; currentRole: string }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(currentRole)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => {
        setOpen(false)
        setSaved(false)
        router.refresh()
      }, 1000)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Edit Role
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-neutral-900">Edit role for {userName}</h3>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {PLATFORM_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || saved} className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
                {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Activate / Deactivate user (admin users page) ────────────────────── */
export function UserStatusButton({
  userId,
  userName,
  status,
  isSelf = false,
}: {
  userId: string
  userName: string
  status: AccountStatus
  isSelf?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isActive = status === 'active'
  const nextStatus: AccountStatus = isActive ? 'inactive' : 'active'
  const actionLabel = isActive ? 'Deactivate' : 'Reactivate'

  const handleConfirm = async () => {
    setWorking(true)
    setError(null)
    const { error } = await setUserStatus(userId, nextStatus)
    setWorking(false)
    if (error) {
      setError(error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        disabled={isSelf}
        title={isSelf ? 'You cannot change your own account status' : undefined}
        className={`rounded border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
          isActive
            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        {actionLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-neutral-900">{actionLabel} {userName}?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              {isActive
                ? 'This user will be signed out of the platform and blocked from logging in until reactivated. Their data is kept.'
                : 'This user will regain access to the platform and be able to log in again.'}
            </p>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={working}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                  isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {working ? 'Saving…' : actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Delete user permanently (admin users page) ───────────────────────── */
export function DeleteUserButton({
  userId,
  userName,
  isSelf = false,
}: {
  userId: string
  userName: string
  isSelf?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirm = async () => {
    setWorking(true)
    setError(null)
    const { error } = await deleteUser(userId)
    setWorking(false)
    if (error) {
      setError(error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); setConfirmText('') }}
        disabled={isSelf}
        title={isSelf ? 'You cannot delete your own account' : undefined}
        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-neutral-900">Delete {userName}?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              This permanently removes the user&apos;s account and profile. This cannot be undone. Consider deactivating instead if you only want to suspend access.
            </p>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Type <span className="font-mono text-red-600">DELETE</span> to confirm</span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={working || confirmText !== 'DELETE'}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {working ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Invite User modal ────────────────────────────────────────────────── */
export function InviteUserButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('PatientAdvocate')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const authCallbackUrl = getAuthCallbackUrl()

  const handleInvite = async () => {
    if (!email.trim()) return
    setSending(true)
    // Use Supabase's invite mechanism
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        data: { role, name: '' },
        emailRedirectTo: authCallbackUrl,
      },
    })
    setSending(false)
    if (!error) {
      setSent(true)
      setTimeout(() => {
        setOpen(false)
        setSent(false)
        setEmail('')
        router.refresh()
      }, 2000)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
      >
        <InviteIcon />
        Invite User
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900">Invite a new user</h3>
            <p className="mt-1 text-sm text-neutral-500">They&apos;ll receive a magic link to join the platform.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.org"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                >
                  {PLATFORM_ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {sent && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                ✓ Invitation sent to {email}!
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleInvite}
                disabled={sending || sent || !email.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {sent ? '✓ Sent!' : sending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function AssignCongressRolesButton({
  userName,
  userId,
  congressId,
  congressTitle,
}: {
  userName: string
  userId: string
  congressId: string | null
  congressTitle?: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const loadAssignments = async () => {
    if (!congressId) {
      setError('No congress event found. Please create/select an event first.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('congress_assignments')
      .select('project_role')
      .eq('user_id', userId)
      .eq('congress_id', congressId)

    setLoading(false)
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setSelectedRoles((data ?? []).map((r) => r.project_role))
  }

  const handleOpen = async () => {
    setOpen(true)
    setSaved(false)
    await loadAssignments()
  }

  const handleSave = async () => {
    if (!congressId) {
      setError('No congress event selected.')
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('congress_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('congress_id', congressId)

    if (deleteError) {
      setSaving(false)
      setError(deleteError.message)
      return
    }

    if (selectedRoles.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const rows = selectedRoles.map((project_role) => ({
        user_id: userId,
        congress_id: congressId,
        project_role,
        scope_all: true,
        workstream_ids: [] as string[],
        effective_from: today,
      }))

      const { error: insertError } = await supabase
        .from('congress_assignments')
        .insert(rows)

      if (insertError) {
        setSaving(false)
        setError(insertError.message)
        return
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setOpen(false)
      setSaved(false)
      router.refresh()
    }, 900)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={!congressId}
        className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Congress Roles
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-neutral-900">Assign congress roles for {userName}</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Event: <span className="font-medium text-neutral-700">{congressTitle ?? 'Current Congress'}</span>
            </p>

            {loading ? (
              <div className="mt-4 text-sm text-neutral-500">Loading current assignments…</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CONGRESS_ROLE_OPTIONS.map((role) => {
                  const checked = selectedRoles.includes(role)
                  return (
                    <label key={role} className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(role)}
                        className="h-4 w-4 rounded border-neutral-300"
                      />
                      <span>{role}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || loading || saved}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Roles'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Create Initiative modal ──────────────────────────────────────────── */
export function CreateInitiativeButton() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState('planning')
  const [pillar, setPillar] = useState('inspire2live')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Build a unique slug; append timestamp suffix on collision
    const baseSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    // Step 1: create the initiative
    const { data: created, error: insertError } = await supabase
      .from('initiatives')
      .insert({
        title: title.trim(),
        slug,
        description: description.trim() || undefined,
        pillar,
        lead_id: user.id,
        status: 'active',
        phase,
      })
      .select('id')
      .single()

    if (insertError || !created?.id) {
      setSaving(false)
      setError(insertError?.message ?? 'Failed to create initiative. Please try again.')
      return
    }

    // Step 2: atomically add creator as lead member so they can access the workspace
    const { error: memberError } = await supabase.from('initiative_members').insert({
      initiative_id: created.id,
      user_id: user.id,
      role: 'lead',
    })

    setSaving(false)

    if (memberError) {
      // Initiative created but membership failed — still navigate, layout will check coordinator role too
      console.warn('Lead membership insert failed:', memberError.message)
    }

    // Navigate directly into the new initiative workspace
    setOpen(false)
    setTitle('')
    setDescription('')
    router.push(`/app/initiatives/${created.id}`)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
      >
        <PlusIcon />
        New Initiative
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900">Create a new initiative</h3>
            <p className="mt-1 text-sm text-neutral-500">You will be added as the initiative lead and taken directly to your new workspace.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Title <span className="text-red-500">*</span></span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Palliative Care Access in Sub-Saharan Africa"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-orange-400 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe the initiative goals and expected outcomes..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-orange-400 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Pillar</span>
                  <select
                    value={pillar}
                    onChange={(e) => setPillar(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  >
                    <option value="inspire2live">Inspire2Live</option>
                    <option value="inspire2go">Inspire2Go</option>
                    <option value="world_campus">World Campus</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Starting phase</span>
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  >
                    <option value="planning">Planning</option>
                    <option value="research">Research</option>
                    <option value="execution">Execution</option>
                  </select>
                </label>
              </div>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                ⚠ {error}
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving || !title.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Initiative'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Create Task modal ────────────────────────────────────────────────── */
export function CreateTaskButton({ initiativeId }: { initiativeId?: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // If no initiative ID given, try to find first active initiative
    let initId = initiativeId
    if (!initId) {
      const { data: inits } = await supabase.from('initiatives').select('id').eq('status', 'active').limit(1)
      initId = inits?.[0]?.id
    }

    if (!initId) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      initiative_id: initId,
      assignee_id: user.id,
      reporter_id: user.id,
      priority,
      status: 'todo',
      due_date: dueDate || null,
    })

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => {
        setOpen(false)
        setSaved(false)
        setTitle('')
        router.refresh()
      }, 1000)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
      >
        <PlusIcon />
        Add Task
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900">Add a new task</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Review biomarker panel results"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-neutral-700">Due date</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            {saved && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                ✓ Task created!
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving || saved || !title.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saved ? '✓ Created!' : saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
