import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* ── Header ── */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/inspire2live-logo.png"
              alt="Inspire2Live"
              width={454}
              height={355}
              priority
              className="h-10 w-auto"
            />
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.inspire2live.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Public website ↗
            </a>

            <Link
              href="/login?tab=signup"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
            >
              Sign up
            </Link>

            <Link
              href="/login?tab=signin"
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="text-center space-y-4 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-700">
            Operational Collaboration Platform
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-balance">
            Where patient advocates, researchers &amp; clinicians drive cancer initiatives forward
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-neutral-600">
            Manage initiatives, track milestones, share evidence, and coordinate across 14 countries.
            Built by and for the Inspire2Live community.
          </p>

          <div className="flex justify-center pt-2">
            <Link
              href="/login?tab=signup"
              className="rounded-lg bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700"
            >
              Get started
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}