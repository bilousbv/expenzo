import { describe, expect, it } from 'vitest';

import { en } from './en';
import { uk } from './uk';

/** Every leaf key, dotted, so the two catalogues can be compared as flat sets. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * Plural suffixes legitimately differ between languages: English resolves
 * `_one` and `_other`, Ukrainian also `_few` and `_many`. Comparing raw keys
 * would demand English carry forms it never selects, so the comparison is
 * between plural groups.
 */
function pluralGroups(value: object): string[] {
  return [
    ...new Set(leafKeys(value).map((key) => key.replace(/_(zero|one|two|few|many|other)$/, ''))),
  ];
}

describe('catalogue parity', () => {
  // TypeScript already types `uk` as the shape of `en`, which catches a missing
  // key at compile time. This catches the two things it cannot: a key that
  // exists but was left as the English string, and a stale key in one
  // catalogue that no longer exists in the other.
  it('translates exactly the same keys in both languages', () => {
    expect(pluralGroups(uk).sort()).toEqual(pluralGroups(en).sort());
  });

  // Ukrainian selects `_few` for 2-4 and `_many` for 5+, and i18next falls back
  // to the singular when they are absent — silently, producing "5 витрата".
  it('carries every Ukrainian plural form for a counted string', () => {
    const forms = Object.keys(uk.expenses).filter((key) => key.startsWith('count'));

    expect(forms.sort()).toEqual(['count_few', 'count_many', 'count_one', 'count_other']);
  });

  it('leaves no value empty', () => {
    const empty = leafKeys(en)
      .concat(leafKeys(uk))
      .filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], {
            ...en,
            ...uk,
          });
        return value === '';
      });

    expect(empty).toEqual([]);
  });

  /**
   * A Ukrainian catalogue that is quietly still English is the failure this
   * package exists to prevent, and the type system cannot see it: a copied
   * English value satisfies `Messages` perfectly.
   *
   * The exceptions are listed rather than pattern-matched, so adding one is a
   * decision somebody made on purpose and can be seen in review.
   */
  const IDENTICAL_ON_PURPOSE = new Set([
    // A proper noun. Translating the product's own name would be a bug.
    'common.appName',
  ]);

  it('does not leave Ukrainian values identical to their English source', () => {
    const read = (source: object, key: string) =>
      key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);

    const untranslated = leafKeys(en).filter((key) => {
      if (IDENTICAL_ON_PURPOSE.has(key)) return false;

      const english = read(en, key);
      const ukrainian = read(uk, key);

      if (typeof english !== 'string' || typeof ukrainian !== 'string') return false;

      return english === ukrainian;
    });

    expect(untranslated).toEqual([]);
  });
});
