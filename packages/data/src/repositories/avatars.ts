import { avatarFileProblem, avatarObjectPath } from '@expenzo/domain';

import type { Database, Db } from '../types';
import type { ProfileRow } from './profiles';

const BUCKET = 'avatars';

const PROFILE_COLUMNS = 'id, first_name, last_name, display_name, display_currency, avatar_path';

/**
 * How long a signed avatar URL stays good for.
 *
 * Longer than the roster query is cached, or a URL expires partway through a
 * session and a face that was there a minute ago renders as a broken image.
 */
export const AVATAR_URL_TTL_SECONDS = 60 * 60;

function toProfile(row: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  display_currency: string | null;
  avatar_path: string | null;
}): ProfileRow {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    displayCurrency: row.display_currency,
    avatarPath: row.avatar_path,
  };
}

async function writeAvatarPath(db: Db, userId: string, path: string | null): Promise<ProfileRow> {
  const patch: Database['public']['Tables']['profiles']['Update'] = { avatar_path: path };

  const { data, error } = await db
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return toProfile(data);
}

/**
 * Stores a member's photo and points their profile at it.
 *
 * Two writes that cannot be one transaction, so the order is the decision:
 * the object goes first, because a failure after it leaves an unreferenced
 * object that nobody ever sees, whereas writing the column first would leave a
 * profile pointing at nothing and render as a broken image.
 *
 * The file is checked here as well as by the bucket. The bucket's refusal is
 * the one that matters — it is the half a client cannot talk its way past —
 * but it arrives as a storage error, and a person who picked a PDF deserves a
 * sentence about the file instead.
 */
export interface AvatarUpload {
  /**
   * The bytes. A Blob on the web; an ArrayBuffer on native, because a React
   * Native Blob reaches storage as zero bytes and the upload silently stores
   * an empty object.
   */
  readonly body: Blob | ArrayBuffer;
  readonly type: string;
  readonly size: number;
}

export async function setMyAvatar(db: Db, userId: string, file: AvatarUpload): Promise<ProfileRow> {
  const problem = avatarFileProblem({ type: file.type, size: file.size });

  if (problem) throw new Error(problem);

  // Built in one place because the path is the permission model: every policy
  // on the bucket is written against its first segment.
  const path = avatarObjectPath(userId);

  const { error } = await db.storage.from(BUCKET).upload(path, file.body, {
    // One object per person, replaced in place. Without this the second photo
    // anyone ever picks fails as a duplicate, which reads as a broken upload
    // rather than as a rule.
    upsert: true,
    // Declared rather than left to be sniffed: the bucket checks its allow-list
    // against what it was told, and an untyped blob lands as an octet-stream
    // and is then refused.
    contentType: file.type,
  });

  if (error) throw new Error(error.message);

  return writeAvatarPath(db, userId, path);
}

/**
 * Takes a member's photo down.
 *
 * The object goes first here too, for the same reason: a profile still
 * pointing at a deleted object renders as a break, while an object nobody
 * references is merely waste.
 */
export async function clearMyAvatar(db: Db, userId: string): Promise<ProfileRow> {
  const { error } = await db.storage.from(BUCKET).remove([avatarObjectPath(userId)]);

  if (error) throw new Error(error.message);

  return writeAvatarPath(db, userId, null);
}

/**
 * Usable URLs for a set of stored paths.
 *
 * The bucket is private, so a URL has to be signed at read time and cannot be
 * kept on the profile. Signed in a single request for the whole roster: one
 * call per member would be five round trips for a household of five before any
 * face appeared.
 */
export async function signedAvatarUrls(db: Db, paths: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];

  if (wanted.length === 0) return new Map();

  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrls(wanted, AVATAR_URL_TTL_SECONDS);

  if (error) throw new Error(error.message);

  const urls = new Map<string, string>();

  for (const entry of data ?? []) {
    // A path that could not be signed — the object is gone, or the policy hid
    // it — is left out rather than mapped to a URL that will not load. The
    // monogram fallback then renders, which is what a member with no photo
    // shows anyway.
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }

  return urls;
}
