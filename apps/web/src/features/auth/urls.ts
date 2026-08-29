/**
 * The two URLs the sign-in screens build, kept in one place because the login
 * page and the magic-link page both need them and a redirect that disagrees
 * between the two is invisible until someone loses their destination.
 */

/**
 * Where GoTrue sends the browser once the link or the provider is done.
 *
 * The origin is passed in rather than read here so this stays testable, and it
 * is the origin the browser actually used: localhost and 127.0.0.1 are separate
 * origins to GoTrue, both are on the allow-list in supabase/config.toml, and an
 * unlisted one does not error — it silently falls back to site_url.
 */
export function callbackUrl(origin: string, redirectTo: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
}

/**
 * The magic-link page, carrying whatever the login page was going to open.
 *
 * Without this the destination is dropped at the door: asking for a link from a
 * guarded URL would sign you in and leave you on the dashboard.
 */
export function magicLinkHref(redirectTo: string): string {
  return redirectTo === '/' ? '/magic-link' : `/magic-link?next=${encodeURIComponent(redirectTo)}`;
}
