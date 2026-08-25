/**
 * Environment validation for the mobile app.
 *
 * Metro string-replaces EXPO_PUBLIC_* at build time, which means every
 * reference must appear literally in the source. Destructuring `process.env`
 * or indexing it dynamically yields undefined in a release build.
 */

import type { OAuthProvider } from '@expenzo/domain';

export interface MobileEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  /** Only the third-party providers that actually have credentials configured. */
  readonly oauthProviders: readonly OAuthProvider[];
}

type Source = Record<string, string | undefined>;

function required(
  source: Source,
  name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
): string {
  const value = source[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy apps/mobile/.env.example to .env and fill it from \`pnpm db:status\`.`,
    );
  }

  return value;
}

export function parseMobileEnv(source: Source): MobileEnv {
  const url = required(source, 'EXPO_PUBLIC_SUPABASE_URL');

  if (!URL.canParse(url)) {
    throw new Error(`EXPO_PUBLIC_SUPABASE_URL is not a valid URL: ${JSON.stringify(url)}`);
  }

  return {
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: required(source, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    oauthProviders: parseProviders(source),
  };
}

/**
 * Metro inlines these as strings, so every value arrives as text. Only an
 * explicit "true" counts: "false" and "0" are both truthy strings, and turning
 * a provider on by accident produces a button that can only fail.
 */
function parseProviders(source: Source): OAuthProvider[] {
  const providers: OAuthProvider[] = [];

  if (source.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH?.trim() === 'true') providers.push('google');
  if (source.EXPO_PUBLIC_ENABLE_APPLE_AUTH?.trim() === 'true') providers.push('apple');

  return providers;
}

let cached: MobileEnv | null = null;

export function env(): MobileEnv {
  cached ??= parseMobileEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_ENABLE_GOOGLE_AUTH: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH,
    EXPO_PUBLIC_ENABLE_APPLE_AUTH: process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH,
  });

  return cached;
}
