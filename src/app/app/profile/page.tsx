import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProfileEditor } from '@/components/profile/profile-editor'
import { NotificationPrefsPanel } from '@/components/profile/notification-prefs-panel'
import { EmailSettings } from '@/components/profile/email-settings'
import {
  formatMemberSince,
  getProfileInitials,
  humanizeAction,
  normalizeExpertiseTags,
  roleLabel,
} from '@/lib/profile-view'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/onboarding')

  // Reconcile the mirrored profiles.email with the authoritative auth email
  // after a confirmed email change (Supabase updates auth.users.email only on
  // confirmation). Cheap and idempotent; keeps display/notifications in sync.
  if (user.email && profile.email !== user.email) {
    await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
    profile.email = user.email
  }

  /* Initiative memberships */
  const { data: memberships } = await supabase
    .from('initiative_members')
    .select('role, initiative_id, initiatives(id, title, status, phase)')
    .eq('user_id', user.id)
    .returns<
      {
        role: string
        initiative_id: string
        initiatives:
          | { id: string; title: string; status: string; phase: string }
          | { id: string; title: string; status: string; phase: string }[]
          | null
      }[]
    >()

  /* Activity log (recent 20 actions) */
  const { data: activity } = await supabase
    .from('activity_log')
    .select('id, action, entity_type, created_at, initiatives(title)')
    .eq('actor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<
      {
        id: string
        action: string
        entity_type: string
        created_at: string
        initiatives: { title: string } | { title: string }[] | null
      }[]
    >()

  const initials = getProfileInitials(profile.name)
  const memberSince = formatMemberSince(profile.created_at)
  const expertiseTags = normalizeExpertiseTags(profile.expertise_tags)

  const contributionCount = activity?.length ?? 0
  const affiliationCount = memberships?.length ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900">{profile.name}</h1>
            {profile.hero_of_cancer_year && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                ⭐ Hero of Cancer {profile.hero_of_cancer_year}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-neutral-600">
            {roleLabel[profile.role] ?? profile.role}
            {profile.organization ? ` · ${profile.organization}` : ''}
            {` · ${profile.country}`}
            {profile.city ? `, ${profile.city}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Member since {memberSince}</p>
          {profile.bio && (
            <p className="mt-2 text-sm text-neutral-700">{profile.bio}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{roleLabel[profile.role] ?? profile.role}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Affiliations</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{affiliationCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Contributions</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{contributionCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Language</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900 uppercase">{profile.language}</p>
        </div>
      </div>

      <ProfileEditor
        userId={user.id}
        profile={{
          name: profile.name,
          bio: profile.bio,
          city: profile.city,
          country: profile.country,
          organization: profile.organization,
          timezone: profile.timezone,
          language: profile.language,
          avatar_url: profile.avatar_url,
          expertise_tags: profile.expertise_tags,
        }}
      />

      <EmailSettings currentEmail={profile.email} />

      <NotificationPrefsPanel notificationPrefs={profile.notification_prefs} />

      {/* Expertise tags */}
      {expertiseTags.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Expertise</h2>
          <div className="flex flex-wrap gap-2">
            {expertiseTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Initiative affiliations */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">
          Initiative Affiliations ({memberships?.length ?? 0})
        </h2>
        {memberships && memberships.length > 0 ? (
          <ul className="space-y-2">
            {memberships.map((m) => {
              const init = Array.isArray(m.initiatives) ? m.initiatives[0] : m.initiatives
              if (!init) return null
              return (
                <li key={m.initiative_id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/app/initiatives/${m.initiative_id}`}
                    className="text-sm font-medium text-neutral-900 hover:text-orange-700"
                  >
                    {init.title}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                      {m.role}
                    </span>
                    <span className="text-xs text-neutral-500 capitalize">{init.status}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No initiative affiliations yet.</p>
        )}
      </section>

      {/* Contribution timeline */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Contribution Timeline</h2>
        {activity && activity.length > 0 ? (
          <ol className="relative border-l border-neutral-200 pl-4 space-y-4">
            {activity.map((a) => {
              const init = Array.isArray(a.initiatives) ? a.initiatives[0] : a.initiatives
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-4.5 flex h-3 w-3 items-center justify-center rounded-full bg-orange-100 ring-4 ring-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  </span>
                  <p className="text-xs text-neutral-500">
                    {new Date(a.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-neutral-900">
                    <span className="font-medium capitalize">{humanizeAction(a.action)}</span>
                    {init ? (
                      <> · <span className="text-neutral-500">{init.title}</span></>
                    ) : null}
                  </p>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">No contributions recorded yet.</p>
        )}
      </section>
    </div>
  )
}
