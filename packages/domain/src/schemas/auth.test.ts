import { describe, expect, it } from 'vitest';

import { credentialsSchema, emailSchema, passwordSchema, registrationSchema } from './auth';

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
