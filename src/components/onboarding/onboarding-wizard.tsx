'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, normalizeRole, type PlatformRole } from '@/lib/role-access'

type InitialProfile = {
  name: string
  role: string
  country: string
  city: string | null
  organization: string | null
  timezone: string
  language: string
} | null

type Highlight = { title: string; desc: string }

/**
 * Per-role onboarding content. The platform assigns the role at invitation time
 * (it is not self-selected here), so the digital onboarding adapts to the user's
 * type. Today the only invited user type is Communications; the others fall back
 * to a sensible generic flow until their tailored content is authored.
 */
type OnboardingFlow = {
  intro: string
  bullets: string[]
  highlights: Highlight[]
  /** Where "Finish" lands the user. Defaults to the shared dashboard. */
  landingPath: string
}

const COMMS_FLOW: OnboardingFlow = {
  intro:
    'Your Communications workspace brings campaigns, channels, and community signals into one place so nothing slips through the cracks.',
  bullets: [
    'Plan and schedule content across every channel from a single planner',
    'Triage incoming WhatsApp and intake messages, and route them to the right owner',
    'Keep the CRM, media library, and Campus log in sync as your work happens',
  ],
  highlights: [
    { title: 'Planner', desc: 'Draft, schedule, and track content across your communication channels.' },
    { title: 'Campus', desc: 'Log sessions and members, and keep the community knowledge base current.' },
    { title: 'WhatsApp & Content organizer', desc: 'Review incoming content, classify it, and route it to the right place.' },
    { title: 'CRM & Library', desc: 'Manage contacts, pipelines, and your shared media assets.' },
  ],
  landingPath: '/app/comms/dashboard',
}

const GENERIC_FLOW: OnboardingFlow = {
  intro:
    'This platform turns decisions into traceable action across initiatives, hubs, and congress cycles.',
  bullets: [
    'Track tasks, milestones, blockers, and evidence in one place',
    'Keep patient voices structurally equal in every workflow',
    'Build institutional memory with traceable decisions and outcomes',
  ],
  highlights: [
    { title: 'Initiatives', desc: 'Follow the initiatives you contribute to and their milestones.' },
    { title: 'Network', desc: 'Find collaborators across the Inspire2Live community.' },
  ],
  landingPath: '/app/dashboard',
}

function getFlow(role: PlatformRole): OnboardingFlow {
  return role === 'Comms' ? COMMS_FLOW : GENERIC_FLOW
}

export function OnboardingWizard({
  userId,
  initialProfile,
}: {
  userId: string
  initialProfile: InitialProfile
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Role is assigned at invitation time — onboarding adapts to it rather than
  // asking the user to pick one.
  const role = normalizeRole(initialProfile?.role)
  const flow = getFlow(role)
  const roleLabel = ROLE_LABELS[role]

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialProfile?.name || '')
  const [country, setCountry] = useState(initialProfile?.country || 'NL')
  const [city, setCity] = useState(initialProfile?.city || '')
  const [organization, setOrganization] = useState(initialProfile?.organization || '')
  const [timezone, setTimezone] = useState(
    initialProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  )
  const [language, setLanguage] = useState(initialProfile?.language || 'en')

  const canContinueProfile = name.trim().length > 1 && country.trim().length > 0
  const totalSteps = 3

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        country: country.trim(),
        city: city.trim() || null,
        organization: organization.trim() || null,
        timezone: timezone.trim() || 'UTC',
        language,
        onboarding_completed: true,
      })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(flow.landingPath)
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Welcome to Inspire2Live Platform</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You&apos;re joining as a <span className="font-medium text-neutral-800">{roleLabel}</span>.
          Let&apos;s set up your workspace in {totalSteps} quick steps.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-orange-600' : 'bg-neutral-200'}`} />
        ))}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-900">Step 1 — Welcome</h2>
            <p className="text-sm text-neutral-600">{flow.intro}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {flow.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-900">Step 2 — Set up your profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Country</span>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">City (optional)</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Organization (optional)</span>
                <input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Timezone</span>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block font-medium text-neutral-700">Language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="nl">Dutch</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinueProfile}
                onClick={() => setStep(3)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-900">Step 3 — Your workspace</h2>
            <p className="text-sm text-neutral-600">
              Here&apos;s what you&apos;ll be working with as a {roleLabel}. You can explore all of it
              from the menu once you finish.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {flow.highlights.map((h) => (
                <div key={h.title} className="rounded-lg border border-neutral-200 p-3">
                  <p className="font-medium text-neutral-900">{h.title}</p>
                  <p className="mt-1 text-xs text-neutral-600">{h.desc}</p>
                </div>
              ))}
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading || !canContinueProfile}
                onClick={handleSubmit}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? 'Finishing...' : 'Finish onboarding'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
