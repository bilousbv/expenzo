import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconTile } from './icon-tile';
import { iconTileGlyphStyle, iconTileStyle, monogramFor } from './icon-tile.styles';

describe('IconTile (web)', () => {
  it('tints itself with the category colour', () => {
    render(<IconTile testID="tile" color="#337dff" />);

    expect(screen.getByTestId('tile')).toHaveStyle({ backgroundColor: '#337dff22' });
  });

  // A saturated tile at this size fights the amount for attention.
  it('washes the colour out rather than using it at full strength', () => {
    expect(iconTileStyle('#337dff').backgroundColor).not.toBe('#337dff');
    expect(iconTileGlyphStyle('#337dff').color).toBe('#337dff');
  });

  it('falls back to a neutral tint for a category with no colour', () => {
    expect(iconTileStyle(null).backgroundColor).toBe('#6b728022');
    expect(iconTileStyle(undefined).backgroundColor).toBe('#6b728022');
  });

  // Colours arrive from the database, where a custom category could hold
  // anything. Appending an alpha suffix to a malformed value would produce a
  // style the platform silently drops, taking the tile with it.
  it('ignores a colour that is not a six-digit hex', () => {
    expect(iconTileStyle('red').backgroundColor).toBe('#6b728022');
    expect(iconTileStyle('#fff').backgroundColor).toBe('#6b728022');
  });

  // Decorative: the row already names the category in text next to it.
  it('is hidden from assistive technology', () => {
    render(<IconTile testID="tile" color="#337dff" />);

    expect(screen.getByTestId('tile')).toHaveAttribute('aria-hidden');
  });
});

describe('monogramFor', () => {
  it('takes the first character, upper-cased', () => {
    expect(monogramFor('netflix')).toBe('N');
    expect(monogramFor('Blue Bottle')).toBe('B');
  });

  it('ignores leading whitespace', () => {
    expect(monogramFor('  Spotify')).toBe('S');
  });

  it('upper-cases outside the Latin alphabet too', () => {
    expect(monogramFor('кава')).toBe('К');
  });

  // An expense with no merchant and no category still needs a tile.
  it('falls back to a question mark when there is no name', () => {
    expect(monogramFor('')).toBe('?');
    expect(monogramFor('   ')).toBe('?');
    expect(monogramFor(null)).toBe('?');
    expect(monogramFor(undefined)).toBe('?');
  });

  // An emoji is two UTF-16 units, and taking only the first renders half a
  // character as a replacement glyph.
  it('keeps a surrogate pair whole', () => {
    expect(monogramFor('🍕 Pizza')).toBe('🍕');
  });
});
