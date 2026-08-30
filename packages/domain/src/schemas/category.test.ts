import { describe, expect, it } from 'vitest';

import { createCategoryInput, updateCategoryInput } from './category';

const VALID = { name: 'Coffee', color: '#337dff', icon: 'coffee' };

describe('createCategoryInput', () => {
  it('accepts a name alone', () => {
    const parsed = createCategoryInput.parse({ name: 'Coffee' });

    expect(parsed.name).toBe('Coffee');
  });

  it('trims the name', () => {
    expect(createCategoryInput.parse({ name: '  Coffee  ' }).name).toBe('Coffee');
  });

  it('rejects a blank name', () => {
    expect(createCategoryInput.safeParse({ name: '   ' }).success).toBe(false);
  });

  // A name of only emoji parses as text but produces no slug, and the slug is
  // what the unique index is built on.
  it('rejects a name that cannot produce a slug', () => {
    const result = createCategoryInput.safeParse({ name: '🎉' });

    expect(result.success).toBe(false);
  });

  it('rejects a name longer than the column allows', () => {
    expect(createCategoryInput.safeParse({ name: 'a'.repeat(65) }).success).toBe(false);
  });

  it('accepts a six-digit hex colour', () => {
    expect(createCategoryInput.parse(VALID).color).toBe('#337dff');
  });

  it('normalises the colour to lowercase, so two spellings are one value', () => {
    expect(createCategoryInput.parse({ ...VALID, color: '#337DFF' }).color).toBe('#337dff');
  });

  it('rejects a three-digit or named colour', () => {
    expect(createCategoryInput.safeParse({ ...VALID, color: '#fff' }).success).toBe(false);
    expect(createCategoryInput.safeParse({ ...VALID, color: 'red' }).success).toBe(false);
  });

  it('turns a blank icon into an absent one, so the column stores NULL', () => {
    expect(createCategoryInput.parse({ name: 'Coffee', icon: '  ' }).icon).toBeUndefined();
  });

  it('rejects a parent id that is not a uuid', () => {
    expect(createCategoryInput.safeParse({ name: 'Coffee', parentId: 'nope' }).success).toBe(false);
  });

  it('defaults sortOrder so new categories land after the seeded ones', () => {
    expect(createCategoryInput.parse({ name: 'Coffee' }).sortOrder).toBe(500);
  });

  it('rejects a negative sortOrder', () => {
    expect(createCategoryInput.safeParse({ name: 'Coffee', sortOrder: -1 }).success).toBe(false);
  });
});

describe('updateCategoryInput', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('requires an id', () => {
    expect(updateCategoryInput.safeParse({ name: 'Coffee' }).success).toBe(false);
  });

  it('allows changing only the name', () => {
    const parsed = updateCategoryInput.parse({ id: ID, name: 'Coffee beans' });

    expect(parsed).toEqual({ id: ID, name: 'Coffee beans' });
  });

  // The slug is frozen at creation. Renaming a category must not move its key,
  // or a household that renames "Coffee" to "Groceries" collides with a slug it
  // never chose — and nothing references the slug anyway, only the id.
  it('has no slug field to change', () => {
    const parsed = updateCategoryInput.parse({ id: ID, name: 'Coffee', slug: 'something-else' });

    expect(parsed).not.toHaveProperty('slug');
  });

  it('applies no defaults, so an omitted field stays omitted', () => {
    expect(updateCategoryInput.parse({ id: ID })).toEqual({ id: ID });
  });

  it('still validates the fields it is given', () => {
    expect(updateCategoryInput.safeParse({ id: ID, color: 'red' }).success).toBe(false);
    expect(updateCategoryInput.safeParse({ id: ID, name: '  ' }).success).toBe(false);
  });
});

describe('the kind a category belongs to', () => {
  /*
   * "Streaming" is an answer to "what do we pay for every month" and
   * "Groceries" is an answer to "what did we spend money on last week". They
   * are two lists, and a category has to say which one it is in.
   */
  it('accepts a subscription category', () => {
    expect(createCategoryInput.parse({ name: 'Streaming', kind: 'subscription' }).kind).toBe(
      'subscription',
    );
  });

  // Everything that existed before the split was an expense category, and
  // every caller that has not been told about kinds still means one.
  it('defaults to the expense taxonomy', () => {
    expect(createCategoryInput.parse({ name: 'Coffee' }).kind).toBe('expense');
  });

  it('refuses a kind that is neither', () => {
    expect(createCategoryInput.safeParse({ name: 'Coffee', kind: 'wishlist' }).success).toBe(false);
  });
});
