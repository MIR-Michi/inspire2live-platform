import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'
import { NewItemModal } from '@/components/comms/new-item-modal'
import { applyCanonicalCommsFallback } from '@/lib/user-workspace'

const workspaceLinks = [
  {
    label: 'Planner',
    href: '/app/comms/planner',
    description: 'Calendar, drafts, review flow, and scheduled output.',
  },
  {
    label: 'Campus',
    href: '/app/comms/campus',
    description: 'Monthly meeting prep, welcomes, and raw feed traceability.',
  },
  {
    label: 'Events',
    href: '/app/comms/events',
    description: 'I2L-owned events, networking attendance, and follow-up outputs.',
  },
  {
    label: 'Library',
    href: '/app/comms/library',
    description: 'Reviewed assets, routed content, people, and topic search.',
  },
]

export default async function CommsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileWithUserType, error: profileWithUserTypeError } = await supabase
    .from('profiles')
    .select('role, onboarding_completed, comms_team, user_type')
    .eq('id', user.id)
    .maybeSingle()
  let profile = profileWithUserType

  if (profileWithUserTypeError) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed, comms_team')
      .eq('id', user.id)
      .maybeSingle()
    profile = fallbackProfile ? { ...fallbackProfile, user_type: 'default' } : null
  }

  profile = applyCanonicalCommsFallback(profile, user.email)

  if (profile && !profile.onboarding_completed) redirect('/onboarding')

  if (!canAccessCommsWorkspace(profile?.role, profile?.comms_team, profile?.user_type)) {
    redirect('/app/dashboard')
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-100">
                Workspace type: Communications
              </span>
              <span className="rounded-full border border-orange-300/40 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-100">
                Provider-safe mode
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Comms operations</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
                A focused comms workspace for planning, campus signals, event follow-up, and reviewed content.
                Existing intake and provider stubs stay available, but the daily working surface is now Planner,
                Campus, Events, and Library.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/app/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-orange-50">
                Shared dashboard
              </Link>
              <Link href="/app/comms/intake" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Intake queue
              </Link>
              <Link href="/app/congress" className="rounded-xl border border-orange-300/40 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-400/10">
                Annual Congress
              </Link>
              <NewItemModal />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {workspaceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:border-orange-300/50 hover:bg-white/[0.09]"
              >
                <p className="text-base font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-300">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {children}
    </div>
  )
}
