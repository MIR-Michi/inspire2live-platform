'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveCampusPresenter } from '@/app/app/comms/campus-log/actions'
import { PresenterAvatar } from '@/components/comms/presenter-avatar'

/**
 * "Highlight of the month" — a compact block (not full column width) that
 * introduces the meeting's presenter (uploadable photo + optional LinkedIn link)
 * next to the highlight text (the session summary). Editing the highlight text
 * itself happens in the session editor via the EDIT link.
 */
export function CampusHighlight({
  sessionId,
  year,
  month,
  uploaderId,
  summary,
  editHref,
  presenterName,
  presenterAvatarUrl,
  presenterLinkedinUrl,
}: {
  sessionId: string
  year: string
  month: string
  uploaderId: string
  summary: string | null
  editHref: string
  presenterName: string | null
  presenterAvatarUrl: string | null
  presenterLinkedinUrl: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const [name, setName] = useState(presenterName ?? '')
  const [linkedin, setLinkedin] = useState(presenterLinkedinUrl ?? '')
  const [avatarUrl, setAvatarUrl] = useState(presenterAvatarUrl ?? '')

  const persist = (fields: { presenter_name: string; presenter_avatar_url: string; presenter_linkedin_url: string }) => {
    setError(null)
    const fd = new FormData()
    fd.set('session_id', sessionId)
    fd.set('year', year)
    fd.set('month', month)
    fd.set('presenter_name', fields.presenter_name)
    fd.set('presenter_avatar_url', fields.presenter_avatar_url)
    fd.set('presenter_linkedin_url', fields.presenter_linkedin_url)
    startTransition(async () => {
      const result = await saveCampusPresenter(fd)
      if (!result.ok) {
        setError(result.message ?? 'Could not save presenter.')
        return
      }
      router.refresh()
    })
  }

  const onUploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    // Files live under a folder named by the uploader id — required by the
    // avatars bucket storage policy.
    const path = `${uploaderId}/campus-presenter-${sessionId}-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      setError(`Could not upload picture: ${uploadError.message}`)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
    event.target.value = ''
    persist({ presenter_name: name, presenter_avatar_url: data.publicUrl, presenter_linkedin_url: linkedin })
  }

  const saveDetails = () => {
    persist({ presenter_name: name.trim(), presenter_avatar_url: avatarUrl, presenter_linkedin_url: linkedin.trim() })
    setEditing(false)
  }

  return (
    <section className="max-w-2xl rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-900">Highlight of the month</h3>
        <Link href={editHref} className="text-xs font-bold uppercase text-blue-900 hover:underline">
          Edit
        </Link>
      </div>

      <div className="mt-3 flex gap-4">
        {/* Presenter avatar + LinkedIn (top-left) */}
        <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
          <PresenterAvatar src={avatarUrl || null} name={name} className="h-20 w-20" rounded="rounded-lg" />

          <label className="cursor-pointer text-[11px] font-semibold text-blue-700 hover:underline">
            {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/*" onChange={onUploadAvatar} disabled={uploading || pending} className="hidden" />
          </label>

          {presenterLinkedinUrl && !editing && (
            <a
              href={presenterLinkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-blue-700 hover:underline"
            >
              LinkedIn ↗
            </a>
          )}
        </div>

        {/* Highlight text + presenter details */}
        <div className="min-w-0 flex-1">
          {name && !editing && <p className="text-sm font-semibold text-neutral-900">{name}</p>}
          <p className="mt-0.5 text-sm leading-6 text-neutral-900">
            {summary || 'Add a short highlight for this month’s meeting.'}
          </p>

          {editing ? (
            <div className="mt-3 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Presenter name"
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="LinkedIn URL (optional)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={pending}
                  className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs font-semibold text-neutral-400 hover:text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              {presenterName || presenterLinkedinUrl ? 'Edit presenter' : '+ Add presenter name / LinkedIn'}
            </button>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  )
}
