/**
 * Environment validation for the mobile app.
 *
 * Metro string-replaces EXPO_PUBLIC_* at build time, which means every
 * reference must appear literally in the source. Destructuring `process.env`
 * or indexing it dynamically yields undefined in a release build.
 */

export interface MobileEnv {
  readonly EXPO_PUBLIC_SUPABASE_URL: string;
  readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
}

type Source = Record<string, string | undefined>;

function required(source: Source, name: keyof MobileEnv): string {
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
  };
}

let cached: MobileEnv | null = null;

export function env(): MobileEnv {
  cached ??= parseMobileEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });

  return cached;
}
