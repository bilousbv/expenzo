import { describe, expect, it } from 'vitest';

import {
  canManageMembers,
  canRemoveMember,
  inviteInput,
  inviteMode,
  invitableRoleSchema,
  memberRoleSchema,
} from './household';

describe('memberRoleSchema', () => {
  it('carries every role the database has', () => {
    expect(memberRoleSchema.options).toEqual(['owner', 'adult', 'child', 'viewer']);
  });
});

describe('invitableRoleSchema', () => {
  // A household has exactly one owner, recorded on households.owner_id, so an
  // invitation cannot offer that role — and viewer is not a thing the invite
  // screen asks about.
  it('offers adult and child only', () => {
    expect(invitableRoleSchema.options).toEqual(['adult', 'child']);
  });

  it('refuses owner', () => {
    expect(invitableRoleSchema.safeParse('owner').success).toBe(false);
  });
});

describe('inviteInput', () => {
  it('lowercases the address, as GoTrue stores it', () => {
    const parsed = inviteInput.parse({ email: '  Ana@Example.COM ', role: 'child' });

    expect(parsed).toEqual({ email: 'ana@example.com', role: 'child' });
  });

  it('defaults to inviting an adult', () => {
    expect(inviteInput.parse({ email: 'ana@example.com' }).role).toBe('adult');
  });

  it('returns a translation key for an address that is not one', () => {
    const parsed = inviteInput.safeParse({ email: 'not-an-address' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('validation.email.invalid');
  });
});

describe('canManageMembers', () => {
  it.each([
    ['owner', true],
    ['adult', true],
    ['child', false],
    ['viewer', false],
  ] as const)('%s → %s', (role, expected) => {
    expect(canManageMembers(role)).toBe(expected);
  });

  // The roster renders before the membership query lands.
  it('is false while the role is unknown', () => {
    expect(canManageMembers(undefined)).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('lets an adult remove a child', () => {
    expect(canRemoveMember('adult', 'child')).toBe(true);
  });

  // The owner row is what households.owner_id points at. Removing it would
  // leave a household nobody can administer.
  it('never removes the owner', () => {
    expect(canRemoveMember('owner', 'owner')).toBe(false);
    expect(canRemoveMember('adult', 'owner')).toBe(false);
  });

  it('refuses a child removing anyone', () => {
    expect(canRemoveMember('child', 'adult')).toBe(false);
  });
});

describe('inviteMode', () => {
  const known = { known: true, accountExists: true };

  it('redeems for somebody already signed in', () => {
    expect(inviteMode({ ...known, signedIn: true })).toBe('accept');
  });

  // Sending an existing account to the registration form fails on "User
  // already registered", and sending a new one to sign in fails on
  // credentials they have never set. Neither failure names the real problem.
  it('sends an existing account to sign in', () => {
    expect(inviteMode({ known: true, signedIn: false, accountExists: true })).toBe('signIn');
  });

  it('sends an unknown address to register', () => {
    expect(inviteMode({ known: true, signedIn: false, accountExists: false })).toBe('register');
  });

  // Spent, revoked, expired and invented all preview as nothing. One answer
  // for the four is also the one that gives nothing away about which.
  it('calls a token that previews nothing invalid, signed in or not', () => {
    expect(inviteMode({ known: false, signedIn: true, accountExists: true })).toBe('invalid');
    expect(inviteMode({ known: false, signedIn: false, accountExists: false })).toBe('invalid');
  });
});
