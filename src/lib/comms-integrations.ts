export type IntegrationTarget = 'wordpress' | 'linkedin' | 'mailchimp' | 'sharepoint' | 'teams'

export type IntegrationStubFlags = Record<IntegrationTarget, boolean>

function envEnabled(value: string | undefined) {
  return value !== 'false'
}

export function getIntegrationStubFlags(): IntegrationStubFlags {
  return {
    wordpress: envEnabled(process.env.NEXT_PUBLIC_FEATURE_STUB_WORDPRESS),
    linkedin: envEnabled(process.env.NEXT_PUBLIC_FEATURE_STUB_LINKEDIN),
    mailchimp: envEnabled(process.env.NEXT_PUBLIC_FEATURE_STUB_MAILCHIMP),
    sharepoint: envEnabled(process.env.NEXT_PUBLIC_FEATURE_STUB_SHAREPOINT),
    teams: envEnabled(process.env.NEXT_PUBLIC_FEATURE_STUB_TEAMS),
  }
}
