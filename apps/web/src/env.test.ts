import { describe, expect, it } from 'vitest';

import { parseWebEnv } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54421',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('parseWebEnv', () => {
  it('accepts a complete environment', () => {
    expect(parseWebEnv(valid)).toEqual(valid);
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
});
