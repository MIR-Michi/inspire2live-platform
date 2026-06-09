// Demo / seed accounts to remove. Resolved by exact (case-insensitive) email
// match, so real accounts — including michael.wittinger@gmail.com and
// michael.wittinger@inspire2live.org — are never touched.
export const DEMO_EMAILS: readonly string[] = [
  // @example.com personas from seed.sql
  'maria@example.com',
  'kwame@example.com',
  'sophie@example.com',
  'hiroshi@example.com',
  'amara@example.com',
  'peter@example.com',
  'lina@example.com',
  // @inspire2live.org personas from the old (now-emptied) seed-demo.sql
  'kai@inspire2live.org',
  'nadia@inspire2live.org',
  'maria@inspire2live.org',
  'sophie@inspire2live.org',
  'peter@inspire2live.org',
  // Other confirmed demo/test accounts
  'marsu101@proton.me',
  'michael.wittinger@multivision.ai',
  'janos.lengyel@multivision.ai',
]
