/**
 * Profile photos.
 *
 * The bucket is private and every policy on it is written against the first
 * path segment, which is the owner's id. That makes the path the permission
 * model rather than merely a filename, which is why it is built here and never
 * assembled at a call site.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches `file_size_limit` on the avatars bucket. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Matches `allowed_mime_types` on the bucket.
 *
 * No SVG. It is an image and also a document that can carry script, and
 * storage serves back what it was handed.
 */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/**
 * Where one person's photo lives.
 *
 * One object per person, replaced in place rather than content-addressed: a
 * name derived from the bytes would orphan the previous photo on every change,
 * and nothing in the system would ever collect them.
 */
export function avatarObjectPath(userId: string): string {
  // The id arrives from a session and should always be a uuid. Checking anyway,
  // because a function that will happily build `../../someone-else/avatar` is
  // one careless caller away from being the whole problem.
  if (!UUID.test(userId)) {
    throw new Error(`Not a user id: ${JSON.stringify(userId)}`);
  }

  return `${userId}/avatar`;
}

export interface AvatarCandidate {
  /** MIME type as the browser or picker reported it. */
  readonly type: string;
  readonly size: number;
}

/**
 * Why this file cannot be used, or null if it can.
 *
 * The bucket enforces both of these too, and it is the half that matters —
 * this side is what turns a rejected upload into a sentence about the file
 * rather than a storage error surfacing raw. Returns a translation key, like
 * every other rule in this package.
 */
export function avatarFileProblem(file: AvatarCandidate): string | null {
  const allowed = AVATAR_MIME_TYPES as readonly string[];

  // Zero bytes is not a photo. It reaches here from a picker that failed
  // rather than from a person choosing an empty file.
  if (file.size <= 0 || !allowed.includes(file.type)) {
    return 'validation.avatar.notAnImage';
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return 'validation.avatar.tooLarge';
  }

  return null;
}
