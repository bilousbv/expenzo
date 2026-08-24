/**
 * Environment validation.
 *
 * A missing variable should fail at startup naming the variable, rather than
 * producing an `undefined` URL and a confusing fetch error on the first query.
 */

export interface WebEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
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
  };
}

let cached: WebEnv | null = null;

/** Validated lazily so importing this module in a test does not throw. */
export function env(): WebEnv {
  // Next inlines these at build time, so they must be referenced literally.
  cached ??= parseWebEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return cached;
}
