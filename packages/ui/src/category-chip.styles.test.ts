import { describe, expect, it } from 'vitest';

import {
  categoryDotStyle,
  categoryChipClass,
  categoryChipLabelClass,
} from './category-chip.styles';

describe('categoryChipClass', () => {
  it('marks the selected chip so it is not colour alone that distinguishes it', () => {
    expect(categoryChipClass(true)).toContain('border-brand-600');
    expect(categoryChipClass(false)).not.toContain('border-brand-600');
  });

  it('appends caller classes last, so they win the tailwind-merge', () => {
    expect(categoryChipClass(false, 'bg-red-500')).toContain('bg-red-500');
  });
});

describe('categoryChipLabelClass', () => {
  it('changes weight as well as colour when selected', () => {
    expect(categoryChipLabelClass(true)).toContain('font-semibold');
    expect(categoryChipLabelClass(false)).not.toContain('font-semibold');
  });
});

describe('categoryDotStyle', () => {
  // The colour is per-row data, not a class name. Tailwind cannot generate a
  // class for an arbitrary hex at build time, so this one value is inline.
  it('returns the category colour as an inline background', () => {
    expect(categoryDotStyle('#337dff')).toEqual({ backgroundColor: '#337dff' });
  });

  // Colours arrive from the database. A row edited outside the app, or seeded
  // before the check existed, must not be able to inject a style.
  it('falls back to a neutral colour for anything that is not a hex triple', () => {
    expect(categoryDotStyle('red; background-image: url(x)')).toEqual({
      backgroundColor: '#9ca3af',
    });
    expect(categoryDotStyle(null)).toEqual({ backgroundColor: '#9ca3af' });
  });
});
