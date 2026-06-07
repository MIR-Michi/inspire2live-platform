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
              width={409}
              height={262}
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
        <section className="text-center space-y-3 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-700">
            Inspire2Live · Internal Platform
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
            The Inspire2Live collaboration workspace
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-600">
            Manage initiatives, track milestones, share evidence, and coordinate across the
            Inspire2Live network. Access is by invitation — sign in with your Inspire2Live account.
          </p>

          <div className="flex justify-center pt-2">
            <Link
              href="/login?tab=signin"
              className="rounded-lg bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}