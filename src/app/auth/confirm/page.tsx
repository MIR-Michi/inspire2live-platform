import Image from 'next/image'

/**
 * Email-link confirmation interstitial.
 *
 * The invite / magic-link / recovery email templates point here instead of
 * directly at /auth/callback. This page does NOT verify the token on load — it
 * only renders a form that POSTs the token to /auth/callback when the human
 * clicks "Continue".
 *
 * Why: corporate mail security (notably Microsoft 365 / Outlook SafeLinks)
 * pre-fetches links in emails to scan them. Because the auth token is
 * single-use, a verify-on-GET callback gets consumed by that scan and the real
 * click then fails. A scanner that pre-opens this page just renders harmless
 * HTML; the single-use token is only spent on the explicit POST.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

  const tokenHash = str(sp.token_hash)
  const code = str(sp.code)
  const type = str(sp.type)
  const next = str(sp.next) || '/app/dashboard'
  const hasCredential = !!tokenHash || !!code

  const copy =
    type === 'invite'
      ? { heading: 'Accept your invitation', cta: 'Accept your invitation' }
      : type === 'recovery'
        ? { heading: 'Reset your password', cta: 'Continue to reset password' }
        : { heading: 'Sign in to Inspire2Live', cta: 'Continue' }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-12">
      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/brand/inspire2live-logo.png"
            alt="Inspire2Live"
            width={409}
            height={262}
            priority
            className="h-9 w-auto"
          />
          <span className="text-base font-semibold text-neutral-900">{copy.heading}</span>
        </div>

        {hasCredential ? (
          <form method="post" action="/auth/callback" className="space-y-4">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <p className="text-sm text-neutral-600">
              Click the button below to continue. For your security this link can only be used once.
            </p>
            <button
              type="submit"
              className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              {copy.cta}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This link is invalid or has expired. Please open the most recent email, or ask for a new one.
            </p>
            <a
              href="/login"
              className="inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Go to sign in
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
