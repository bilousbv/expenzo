import { describe, expect, it } from '@jest/globals';

import { parseMobileEnv } from '../src/env';

const valid = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('parseMobileEnv', () => {
  it('accepts a complete environment', () => {
    expect(parseMobileEnv(valid)).toEqual(valid);
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
