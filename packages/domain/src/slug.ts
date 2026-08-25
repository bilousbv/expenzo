/**
 * URL- and key-safe slugs.
 *
 * A category's slug is its stable key inside a household: the unique index is
 * built on it, and it is frozen at creation so renaming never moves it. That
 * makes this a database concern rather than a display one — the display name
 * keeps every character the user typed.
 */

/** Matches the `slug text` column's practical ceiling, and keeps URLs sane. */
const MAX_LENGTH = 48;

export function slugify(raw: string | null | undefined): string {
  if (!raw) return '';

  let value = raw.toLowerCase();

  // Decompose then drop the combining marks, so "Café" becomes "cafe" rather
  // than losing the letter entirely.
  value = value.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Apostrophes close up rather than splitting: "sam's" -> "sams". Every other
  // non-alphanumeric run becomes a single hyphen.
  value = value.replace(/['’]/g, '');
  value = value.replace(/[^a-z0-9]+/g, '-');

  value = value.replace(/^-+|-+$/g, '');

  if (value.length > MAX_LENGTH) {
    // Trimming again after the cut: slicing mid-word can leave a trailing
    // hyphen, and a slug ending in a separator is not one anybody chose.
    value = value.slice(0, MAX_LENGTH).replace(/-+$/, '');
  }

  return value;
}
