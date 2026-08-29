import { describe, expect, it } from 'vitest';

import {
  credentialsSchema,
  emailSchema,
  passwordSchema,
  registrationSchema,
  signInLinkErrorKey,
} from './auth';

describe('emailSchema', () => {
  it('accepts an ordinary address', () => {
    expect(emailSchema.parse('ana@example.com')).toBe('ana@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(emailSchema.parse('  ana@example.com  ')).toBe('ana@example.com');
  });

  // GoTrue stores and compares addresses lowercased. Registering as
  // Ana@Example.com and then signing in as ana@example.com must be one account,
  // so the case is settled here rather than left to whichever screen asks.
  it('lowercases, so one address is one account', () => {
    expect(emailSchema.parse('Ana@Example.COM')).toBe('ana@example.com');
  });

  it('rejects an address with no domain', () => {
    expect(emailSchema.safeParse('ana@').success).toBe(false);
    expect(emailSchema.safeParse('ana').success).toBe(false);
  });

  it('rejects an address with a space in it', () => {
    expect(emailSchema.safeParse('a na@example.com').success).toBe(false);
  });

  it('rejects an empty string with a message about the address', () => {
    const result = emailSchema.safeParse('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/email/i);
    }
  });
});

describe('passwordSchema', () => {
  it('accepts eight characters', () => {
    expect(passwordSchema.parse('hunter22')).toBe('hunter22');
  });

  it('rejects seven, matching the server minimum', () => {
    expect(passwordSchema.safeParse('hunter2').success).toBe(false);
  });

  // bcrypt, which GoTrue hashes with, silently ignores everything past 72
  // bytes. A longer password appears to work and then any 72-byte prefix of it
  // also signs in — better to refuse it than to quietly truncate.
  it('rejects a password longer than bcrypt actually reads', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });

  // The limit is bytes, not characters: an emoji is four of them, so 20 of
  // them already exceed what bcrypt reads.
  it('counts the limit in bytes rather than characters', () => {
    expect(passwordSchema.safeParse('🎉'.repeat(19)).success).toBe(false);
  });

  it('does not trim, because a space is a legitimate character', () => {
    expect(passwordSchema.parse(' hunter2 ')).toBe(' hunter2 ');
  });
});

describe('credentialsSchema', () => {
  it('accepts an address and a password together', () => {
    expect(credentialsSchema.parse({ email: 'Ana@example.com', password: 'hunter22' })).toEqual({
      email: 'ana@example.com',
      password: 'hunter22',
    });
  });

  it('reports the email problem against the email field', () => {
    const result = credentialsSchema.safeParse({ email: 'nope', password: 'hunter22' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['email']);
    }
  });
});

describe('registrationSchema', () => {
  const valid = {
    email: 'ana@example.com',
    password: 'hunter22',
    confirmPassword: 'hunter22',
    firstName: 'Ana',
    baseCurrency: 'USD',
  };

  it('accepts a matching confirmation', () => {
    expect(registrationSchema.parse(valid).email).toBe('ana@example.com');
  });

  it('rejects a mismatched confirmation', () => {
    const result = registrationSchema.safeParse({ ...valid, confirmPassword: 'hunter23' });

    expect(result.success).toBe(false);
  });

  // The message has to land on the confirmation field, not the password one —
  // otherwise the error appears above the box the user needs to fix.
  it('attaches the mismatch to the confirmation field', () => {
    const result = registrationSchema.safeParse({ ...valid, confirmPassword: 'hunter23' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  // A password too short is a different complaint from one that does not
  // match, and reporting the mismatch first would send the user to the wrong
  // field.
  it('reports a short password before it reports a mismatch', () => {
    const result = registrationSchema.safeParse({
      email: 'ana@example.com',
      password: 'short',
      confirmPassword: 'different',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['password']);
    }
  });
});

describe('registrationSchema, the parts that become a profile', () => {
  const valid = {
    email: 'ana@example.com',
    password: 'hunter22',
    confirmPassword: 'hunter22',
    firstName: 'Ana',
    baseCurrency: 'UAH',
  };

  it('carries the names and the chosen currency through', () => {
    expect(registrationSchema.parse({ ...valid, lastName: 'Petrenko' })).toMatchObject({
      firstName: 'Ana',
      lastName: 'Petrenko',
      baseCurrency: 'UAH',
    });
  });

  /*
   * A first name is what labels every expense once a second person joins, and
   * the signup form is the only moment anyone is reliably willing to type it.
   * The magic-link path has no form at all and keeps the trigger's fallback.
   */
  it('requires a first name', () => {
    const result = registrationSchema.safeParse({ ...valid, firstName: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['firstName']);
    }
  });

  // Plenty of people have one name, and plenty more will not give a surname to
  // a budgeting app. Neither is a reason to refuse the account.
  it('does not require a last name', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  /*
   * This is the household's base currency, the one every expense is converted
   * into and frozen at, and it cannot be changed once anything is recorded.
   * Guessing it and being wrong is expensive, so the form has to ask.
   */
  it('requires a currency to open the household in', () => {
    const { baseCurrency: _dropped, ...withoutCurrency } = valid;

    expect(registrationSchema.safeParse(withoutCurrency).success).toBe(false);
  });

  it('rejects a currency that is not an ISO code', () => {
    expect(registrationSchema.safeParse({ ...valid, baseCurrency: 'uah' }).success).toBe(false);
  });
});

describe('signInLinkErrorKey', () => {
  /*
   * A sign-in link no longer creates an account, so GoTrue refuses one for an
   * address it does not know. Its own wording is written for an API client —
   * "Signups not allowed for otp" tells whoever asked for a link nothing they
   * can act on.
   */
  it('names the real problem when there is no account to sign in to', () => {
    expect(signInLinkErrorKey('Signups not allowed for otp')).toBe('auth.errors.noAccountForLink');
  });

  it('matches however GoTrue happens to case it', () => {
    expect(signInLinkErrorKey('signups not allowed for OTP')).toBe('auth.errors.noAccountForLink');
  });

  // Anything else is the server describing something we did not anticipate,
  // and its own words are more use than a guess of ours.
  it('leaves any other failure to speak for itself', () => {
    expect(signInLinkErrorKey('Email rate limit exceeded')).toBeNull();
  });
});
