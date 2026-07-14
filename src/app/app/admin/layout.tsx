/**
 * Admin routes are sections of the Platform Settings space (ADR-0010). They keep
 * their `/app/admin/*` URLs but render inside the shared settings shell so Users,
 * Roles & Permissions, AI, Org Feed, Activity, and Feedback all appear as
 * sections of one settings space rather than a flat admin dump. Each page keeps
 * its own PlatformAdmin gate; this layout only supplies the chrome.
 *
 * Exception: the guest-submissions route redirects out to its component surface
 * and renders no settings chrome.
 */
import { SettingsShell } from '@/components/layouts/settings-shell'

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>
}
