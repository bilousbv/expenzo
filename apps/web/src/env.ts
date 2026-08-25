/**
 * Environment validation.
 *
 * A missing variable should fail at startup naming the variable, rather than
 * producing an `undefined` URL and a confusing fetch error on the first query.
 */

import type { OAuthProvider } from '@expenzo/domain';

export interface WebEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  /** Only the third-party providers that actually have credentials configured. */
  readonly oauthProviders: readonly OAuthProvider[];
}

type Source = Record<string, string | undefined>;

function required(source: Source, name: keyof WebEnv): string {
  const value = source[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy apps/web/.env.example to .env.local and fill it from \`pnpm db:status\`.`,
    );
  }

  return value;
}

export function parseWebEnv(source: Source): WebEnv {
  const url = required(source, 'NEXT_PUBLIC_SUPABASE_URL');

  if (!URL.canParse(url)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${JSON.stringify(url)}`);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required(source, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    oauthProviders: parseProviders(source),
  };
}

/**
 * Next inlines these as strings, so every value arrives as text. Only an
 * explicit "true" counts: "false" and "0" are both truthy strings, and turning
 * a provider on by accident produces a button that can only fail.
 */
function parseProviders(source: Source): OAuthProvider[] {
  const providers: OAuthProvider[] = [];

  // Google first, matching the order the buttons render in.
  if (source.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH?.trim() === 'true') providers.push('google');
  if (source.NEXT_PUBLIC_ENABLE_APPLE_AUTH?.trim() === 'true') providers.push('apple');

  return providers;
}

let cached: WebEnv | null = null;

/** Validated lazily so importing this module in a test does not throw. */
export function env(): WebEnv {
  // Next inlines these at build time, so they must be referenced literally.
  cached ??= parseWebEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH,
    NEXT_PUBLIC_ENABLE_APPLE_AUTH: process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH,
  });

  return cached;
}
