import { describe, expect, it } from 'vitest';

import { parseWebEnv } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('parseWebEnv', () => {
  it('accepts a complete environment', () => {
    expect(parseWebEnv(valid)).toEqual({ ...valid, oauthProviders: [] });
  });

  // A missing variable should fail at startup with the variable's name, rather
  // than producing an undefined URL and a confusing fetch error on first query.
  it('names the missing variable', () => {
    expect(() => parseWebEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('rejects a blank value as firmly as a missing one', () => {
    expect(() => parseWebEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('rejects a URL that is not a URL', () => {
    expect(() => parseWebEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  // Apple and Google are configured in supabase/config.toml but disabled until
  // real credentials exist. A button for a provider that is off can only fail,
  // so the flags decide whether it is rendered at all.
  it('offers no third-party providers by default', () => {
    expect(parseWebEnv(valid).oauthProviders).toEqual([]);
  });

  it('enables a provider when its flag is set', () => {
    expect(
      parseWebEnv({ ...valid, NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: 'true' }).oauthProviders,
    ).toEqual(['google']);
  });

  // Google before Apple, matching the order the buttons are rendered in.
  it('keeps a stable order when both are enabled', () => {
    expect(
      parseWebEnv({
        ...valid,
        NEXT_PUBLIC_ENABLE_APPLE_AUTH: 'true',
        NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: 'true',
      }).oauthProviders,
    ).toEqual(['google', 'apple']);
  });

  // Next inlines these as strings, so every value arrives as text. Only an
  // explicit "true" counts — "false", "0" and a stray empty string must not
  // switch a provider on.
  it('treats anything other than "true" as off', () => {
    for (const value of ['false', '0', '', 'yes', undefined]) {
      expect(
        parseWebEnv({ ...valid, NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: value }).oauthProviders,
      ).toEqual([]);
    }
  });
});
