import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { AVATAR_URL_TTL_SECONDS, clearMyAvatar, setMyAvatar, signedAvatarUrls } from './avatars';

const ANA = '11111111-1111-4111-8111-111111111111';
const BEN = '22222222-2222-4222-8222-222222222222';

const savedProfile = {
  id: ANA,
  first_name: 'Ana',
  last_name: null,
  display_name: 'ana',
  display_currency: null,
  avatar_path: `${ANA}/avatar`,
};

function fakeDb(
  options: {
    signed?: { path: string; signedUrl: string | null; error?: string | null }[];
    uploadError?: { message: string } | null;
    profile?: unknown;
  } = {},
) {
  const uploads: { path: string; options: unknown }[] = [];
  const removed: string[][] = [];
  const updates: unknown[] = [];
  let signedFor: string[] = [];

  const table: Record<string, unknown> = {
    select: () => table,
    update: (payload: unknown) => {
      updates.push(payload);
      return table;
    },
    eq: () => table,
    single: () => Promise.resolve({ data: options.profile ?? savedProfile, error: null }),
  };

  const bucket = {
    upload: (path: string, _body: unknown, opts: unknown) => {
      uploads.push({ path, options: opts });
      return Promise.resolve({ data: { path }, error: options.uploadError ?? null });
    },
    remove: (paths: string[]) => {
      removed.push(paths);
      return Promise.resolve({ data: null, error: null });
    },
    createSignedUrls: (paths: string[]) => {
      signedFor = paths;
      return Promise.resolve({ data: options.signed ?? [], error: null });
    },
  };

  const db = {
    from: vi.fn(() => table),
    storage: { from: vi.fn(() => bucket) },
  };

  return {
    db: db as unknown as Db,
    uploads,
    removed,
    updates,
    signedPaths: () => signedFor,
  };
}

describe('setMyAvatar', () => {
  const file = { body: new Blob(['not really a jpeg']), type: 'image/jpeg', size: 17 };

  it('stores the object under the owner’s own prefix', async () => {
    const { db, uploads } = fakeDb();

    await setMyAvatar(db, ANA, file);

    expect(uploads[0]?.path).toBe(`${ANA}/avatar`);
  });

  /*
   * One object per person, replaced in place. Without upsert the second photo
   * anyone ever chooses fails with a duplicate, which looks like a broken
   * upload rather than a rule.
   */
  it('replaces the previous photo rather than failing on it', async () => {
    const { db, uploads } = fakeDb();

    await setMyAvatar(db, ANA, file);

    expect(uploads[0]?.options).toMatchObject({ upsert: true });
  });

  /*
   * Sent explicitly rather than left to storage to sniff. The bucket's
   * allow-list is checked against the declared type, and a blob arriving with
   * no type would be stored as an octet-stream and then refused.
   */
  it('declares the content type it is uploading', async () => {
    const { db, uploads } = fakeDb();

    await setMyAvatar(db, ANA, file);

    expect(uploads[0]?.options).toMatchObject({ contentType: 'image/jpeg' });
  });

  // The column is what every read starts from, so an upload that does not
  // record itself is an orphaned object nobody will ever see.
  it('records the path on the profile', async () => {
    const { db, updates } = fakeDb();

    await setMyAvatar(db, ANA, file);

    expect(updates).toEqual([{ avatar_path: `${ANA}/avatar` }]);
  });

  /*
   * The upload and the column are two writes and cannot be one transaction.
   * Uploading first means a failure leaves an unreferenced object, which is
   * invisible; writing the column first would leave a profile pointing at
   * nothing, which renders as a broken image.
   */
  it('does not touch the profile when the upload failed', async () => {
    const { db, updates } = fakeDb({ uploadError: { message: 'Payload too large' } });

    await expect(setMyAvatar(db, ANA, file)).rejects.toThrow('Payload too large');
    expect(updates).toEqual([]);
  });

  it('refuses a file the bucket would reject anyway', async () => {
    const { db, uploads } = fakeDb();
    const pdf = { body: new Blob(['%PDF']), type: 'application/pdf', size: 4 };

    await expect(setMyAvatar(db, ANA, pdf)).rejects.toThrow(/validation\.avatar/);
    expect(uploads).toEqual([]);
  });
});

describe('clearMyAvatar', () => {
  it('removes the object and forgets the path', async () => {
    const { db, removed, updates } = fakeDb({ profile: { ...savedProfile, avatar_path: null } });

    await clearMyAvatar(db, ANA);

    expect(removed).toEqual([[`${ANA}/avatar`]]);
    expect(updates).toEqual([{ avatar_path: null }]);
  });
});

describe('signedAvatarUrls', () => {
  /*
   * The bucket is private, so a usable URL has to be signed at read time and
   * cannot be stored. Signed in one call for the whole roster rather than one
   * per member: a household of five would otherwise be five round trips before
   * anything renders.
   */
  it('signs every path in one request', async () => {
    const { db, signedPaths } = fakeDb({
      signed: [
        { path: `${ANA}/avatar`, signedUrl: 'https://signed/ana' },
        { path: `${BEN}/avatar`, signedUrl: 'https://signed/ben' },
      ],
    });

    const urls = await signedAvatarUrls(db, [`${ANA}/avatar`, `${BEN}/avatar`]);

    expect(signedPaths()).toEqual([`${ANA}/avatar`, `${BEN}/avatar`]);
    expect(urls.get(`${ANA}/avatar`)).toBe('https://signed/ana');
  });

  it('asks for nothing when nobody has a photo', async () => {
    const { db } = fakeDb();

    const urls = await signedAvatarUrls(db, []);

    expect(urls.size).toBe(0);
    expect(db.storage.from).not.toHaveBeenCalled();
  });

  it('does not sign the same path twice', async () => {
    const { db, signedPaths } = fakeDb({
      signed: [{ path: `${ANA}/avatar`, signedUrl: 'https://signed/ana' }],
    });

    await signedAvatarUrls(db, [`${ANA}/avatar`, `${ANA}/avatar`]);

    expect(signedPaths()).toEqual([`${ANA}/avatar`]);
  });

  /*
   * A member whose photo could not be signed — the object is gone, or the
   * policy hid it — is left out rather than mapped to a broken URL. The
   * monogram fallback then renders, which is what an avatar with no photo
   * shows anyway.
   */
  it('leaves out a path that could not be signed', async () => {
    const { db } = fakeDb({
      signed: [
        { path: `${ANA}/avatar`, signedUrl: null, error: 'Object not found' },
        { path: `${BEN}/avatar`, signedUrl: 'https://signed/ben' },
      ],
    });

    const urls = await signedAvatarUrls(db, [`${ANA}/avatar`, `${BEN}/avatar`]);

    expect(urls.has(`${ANA}/avatar`)).toBe(false);
    expect(urls.get(`${BEN}/avatar`)).toBe('https://signed/ben');
  });

  // A URL that expires before the query holding it goes stale renders as a
  // broken image partway through a session.
  it('signs for longer than the roster is cached', () => {
    expect(AVATAR_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60 * 60);
  });
});

describe('setMyAvatar, from a phone', () => {
  /*
   * Native sends an ArrayBuffer rather than a Blob. A React Native Blob
   * reaches Supabase storage as zero bytes, and the upload succeeds while
   * storing an empty object — a failure that looks exactly like success until
   * somebody tries to view the photo.
   */
  it('takes an ArrayBuffer as readily as a Blob', async () => {
    const { db, uploads, updates } = fakeDb();

    await setMyAvatar(db, ANA, {
      body: new ArrayBuffer(2048),
      type: 'image/jpeg',
      size: 2048,
    });

    expect(uploads[0]?.path).toBe(`${ANA}/avatar`);
    expect(updates).toEqual([{ avatar_path: `${ANA}/avatar` }]);
  });

  // The picker reports the size, and the bytes are the same either way, so the
  // rule has to be enforced against what was declared.
  it('applies the same limits to it', async () => {
    const { db, uploads } = fakeDb();

    await expect(
      setMyAvatar(db, ANA, {
        body: new ArrayBuffer(8),
        type: 'image/jpeg',
        size: 3 * 1024 * 1024,
      }),
    ).rejects.toThrow('validation.avatar.tooLarge');
    expect(uploads).toEqual([]);
  });
});
