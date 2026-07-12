type AuthUrlOptions = {
  configuredAppUrl?: string
  browserOrigin?: string
}

export function getAuthBaseUrl(options?: AuthUrlOptions): string {
  const configuredAppUrl = options?.configuredAppUrl?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim()
  const isLocalConfiguredUrl =
    !!configuredAppUrl && /localhost|127\.0\.0\.1/i.test(configuredAppUrl)

  if (configuredAppUrl && /^https?:\/\//.test(configuredAppUrl) && !isLocalConfiguredUrl) {
    return configuredAppUrl.replace(/\/+$/, '')
  }

  const currentOrigin = options?.browserOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)

  if (currentOrigin) {
    const isLocalOrigin = /localhost|127\.0\.0\.1/i.test(currentOrigin)

    if (configuredAppUrl && /^https?:\/\//.test(configuredAppUrl) && isLocalConfiguredUrl && !isLocalOrigin) {
      // In production, ignore accidentally configured localhost NEXT_PUBLIC_APP_URL.
      return currentOrigin.replace(/\/+$/, '')
    }

    return currentOrigin.replace(/\/+$/, '')
  }

  return 'http://localhost:3000'
}

export function getAuthCallbackUrl(options?: AuthUrlOptions): string {
  return `${getAuthBaseUrl(options)}/auth/callback`
}
