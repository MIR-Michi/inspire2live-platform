'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseExpertiseInput } from '@/lib/profile-view'

type EditableProfile = {
  name: string
  bio: string | null
  city: string | null
  country: string
  organization: string | null
  timezone: string
  language: string
  avatar_url: string | null
  expertise_tags: string[] | null
}

export function ProfileEditor({
  userId,
  profile,
}: {
  userId: string
  profile: EditableProfile
}) {
  const supabase = useMemo(() => createClient(), [])

  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [country, setCountry] = useState(profile.country)
  const [organization, setOrganization] = useState(profile.organization ?? '')
  const [timezone, setTimezone] = useState(profile.timezone)
  const [language, setLanguage] = useState(profile.language)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [expertiseInput, setExpertiseInput] = useState((profile.expertise_tags ?? []).join(', '))

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [saveSuccess, setSaveSuccess] = useState(false)
  const canSave = name.trim().length > 1 && country.trim().length > 0 && !saving && !uploading

  const onUploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)
    setSaveSuccess(false)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    // Files live under a folder named by the user id — required by the avatars
    // bucket storage policy (avatar_upload).
    const path = `${userId}/portrait-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setMessage(`Could not upload picture: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
    setMessage('✓ Picture uploaded — click Save Changes to apply it everywhere.')
    event.target.value = ''
  }

  const onSave = async () => {
    if (!canSave) return
    setSaving(true)
    setMessage(null)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        country: country.trim(),
        organization: organization.trim() || null,
        timezone: timezone.trim() || 'UTC',
        language,
        avatar_url: avatarUrl.trim() || null,
        expertise_tags: parseExpertiseInput(expertiseInput),
      })
      .eq('id', userId)

    if (error) {
      setMessage(`Could not save profile: ${error.message}`)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaveSuccess(true)
    setMessage('✓ Profile saved successfully!')
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  return (
    <section className="rounded-xl border-2 border-orange-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900">✏️ Edit Your Profile</h2>
          <p className="text-xs text-neutral-500">Change your details below and click Save.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
            saveSuccess
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {saving ? 'Saving…' : saveSuccess ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${saveSuccess ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Country</span>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Organization</span>
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Timezone</span>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2">
            <option value="en">English</option>
            <option value="nl">Dutch</option>
          </select>
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block text-neutral-600">Portrait picture</span>
          <div className="flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Your portrait" className="h-20 w-20 rounded-lg border border-neutral-200 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                No photo
              </div>
            )}
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                {uploading ? 'Uploading…' : 'Upload picture'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onUploadAvatar}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-neutral-400">PNG, JPG, WEBP or GIF, up to 5MB. Your picture is shared with the CRM.</p>
            </div>
          </div>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="…or paste an image URL"
          />
        </div>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-neutral-600">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-neutral-600">Expertise tags (comma separated)</span>
          <input value={expertiseInput} onChange={(e) => setExpertiseInput(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2" placeholder="Patient advocacy, Policy, Prevention" />
        </label>
      </div>

    </section>
  )
}
