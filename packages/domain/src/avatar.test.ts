import { describe, expect, it } from 'vitest';

import { avatarFileProblem, avatarObjectPath, AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from './avatar';

const ANA = '11111111-1111-4111-8111-111111111111';

describe('avatarObjectPath', () => {
  /*
   * The owner's id is the first path segment because that is what the storage
   * policy checks: a member may write under their own prefix and nowhere else.
   * Anything clever about the layout has to survive being read by a policy.
   */
  it('puts the owner first, which is what the policy matches on', () => {
    expect(avatarObjectPath(ANA)).toBe(`${ANA}/avatar`);
  });

  /*
   * One object per person, replaced in place. A content-addressed name would
   * orphan the previous photo on every change, and nothing would ever collect
   * them.
   */
  it('is the same path however many times a photo is replaced', () => {
    expect(avatarObjectPath(ANA)).toBe(avatarObjectPath(ANA));
  });

  // The path is built from a value that arrives from a session, but a function
  // that will happily build `../../someone-else/avatar` is one bad caller away
  // from being the problem.
  it('refuses anything that is not a user id', () => {
    expect(() => avatarObjectPath('../ben')).toThrow();
    expect(() => avatarObjectPath('')).toThrow();
    expect(() => avatarObjectPath(`${ANA}/../${ANA}`)).toThrow();
  });
});

describe('avatarFileProblem', () => {
  it('accepts an ordinary photo', () => {
    expect(avatarFileProblem({ type: 'image/jpeg', size: 400_000 })).toBeNull();
  });

  it('accepts every type the bucket allows', () => {
    for (const type of AVATAR_MIME_TYPES) {
      expect(avatarFileProblem({ type, size: 1000 })).toBeNull();
    }
  });

  /*
   * The bucket enforces this too. Checking here as well is what turns a
   * rejected upload into a sentence about the file rather than a storage
   * error surfacing raw.
   */
  it('rejects a file larger than the bucket will take', () => {
    expect(avatarFileProblem({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe(
      'validation.avatar.tooLarge',
    );
  });

  it('accepts one exactly at the limit', () => {
    expect(avatarFileProblem({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull();
  });

  it('rejects something that is not an image', () => {
    expect(avatarFileProblem({ type: 'application/pdf', size: 1000 })).toBe(
      'validation.avatar.notAnImage',
    );
  });

  // An SVG is an image and also a document that can carry script. The bucket
  // serves what it is given, so this is not the place to be broad-minded.
  it('rejects an SVG, which is a script container as much as an image', () => {
    expect(avatarFileProblem({ type: 'image/svg+xml', size: 1000 })).toBe(
      'validation.avatar.notAnImage',
    );
  });

  it('rejects an empty file rather than storing nothing', () => {
    expect(avatarFileProblem({ type: 'image/png', size: 0 })).toBe('validation.avatar.notAnImage');
  });
});
