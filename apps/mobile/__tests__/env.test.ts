import { describe, expect, it } from '@jest/globals';

import { parseMobileEnv } from '../src/env';

const valid = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('parseMobileEnv', () => {
  it('accepts a complete environment', () => {
    expect(parseMobileEnv(valid)).toEqual({ ...valid, oauthProviders: [] });
  });

  // Apple and Google are configured in supabase/config.toml but disabled until
  // real credentials exist. A button for a provider that is off can only fail.
  it('offers no third-party providers by default', () => {
    expect(parseMobileEnv(valid).oauthProviders).toEqual([]);
  });

  it('enables a provider when its flag is set', () => {
    expect(
      parseMobileEnv({ ...valid, EXPO_PUBLIC_ENABLE_APPLE_AUTH: 'true' }).oauthProviders,
    ).toEqual(['apple']);
  });

  // Metro inlines these as strings, so every value arrives as text and "false"
  // is a truthy string.
  it('treats anything other than "true" as off', () => {
    for (const value of ['false', '0', '', 'yes', undefined]) {
      expect(
        parseMobileEnv({ ...valid, EXPO_PUBLIC_ENABLE_GOOGLE_AUTH: value }).oauthProviders,
      ).toEqual([]);
    }
  });

  it('names the missing variable', () => {
    expect(() => parseMobileEnv({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow(
      /EXPO_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('rejects a URL that is not a URL', () => {
    expect(() => parseMobileEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL/,
    );
  });
});
