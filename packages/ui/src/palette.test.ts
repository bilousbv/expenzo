import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COLOR_TOKENS, DARK, LIGHT, paletteVariables, type ColorToken } from './palette';

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('the palettes', () => {
  /*
   * The two schemes are swapped by redefining variables, so a token defined in
   * one and missing from the other does not fail loudly — it silently keeps the
   * other scheme's value, and a single wrong colour in dark mode is exactly the
   * kind of thing nobody notices until it ships.
   */
  it('define exactly the same tokens', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
    expect(Object.keys(DARK).sort()).toEqual([...COLOR_TOKENS].sort());
  });

  it('are all valid six-digit hex', () => {
    for (const scheme of [DARK, LIGHT]) {
      for (const [token, value] of Object.entries(scheme)) {
        expect(value, token).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // Dark is the default, so this is the pairing most people will read.
  it('put readable text on every dark surface', () => {
    expect(contrast(DARK.content, DARK.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK.content, DARK.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK.content, DARK['surface-muted'])).toBeGreaterThanOrEqual(4.5);
  });

  it('put readable text on every light surface', () => {
    expect(contrast(LIGHT.content, LIGHT.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(LIGHT.content, LIGHT.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(LIGHT.content, LIGHT['surface-muted'])).toBeGreaterThanOrEqual(4.5);
  });

  // Muted text is still text. 3:1 is the large-text floor and the lowest this
  // should ever go, since it carries dates, counts and helper lines.
  it('keep muted text legible in both schemes', () => {
    expect(contrast(DARK['content-muted'], DARK.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT['content-muted'], LIGHT.surface)).toBeGreaterThanOrEqual(3);
  });

  /*
   * The reference uses amber for every call to action, and amber is bright.
   * Its label has to be dark, which is why the primary button's text colour is
   * `content-on-accent` rather than the ordinary inverse — the same trap the
   * mint accent had before this palette.
   */
  it('give the amber action colour a label that can be read on it', () => {
    for (const scheme of [DARK, LIGHT]) {
      expect(contrast(scheme['content-on-accent'], scheme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Income and spending are told apart by colour on every screen, so both have
  // to survive their own background.
  it('keep the money colours readable on their surface', () => {
    for (const scheme of [DARK, LIGHT]) {
      expect(contrast(scheme.positive, scheme.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(scheme.negative, scheme.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  // Dark is the default, and a dark scheme whose surfaces match its background
  // has no cards at all.
  it('separate the card from the page it sits on', () => {
    expect(DARK.surface).not.toBe(DARK.background);
    expect(LIGHT.surface).not.toBe(LIGHT.background);
  });
});

describe('paletteVariables', () => {
  /*
   * Tailwind reads these as `rgb(var(--color-x) / <alpha-value>)`, which needs
   * the channels unwrapped rather than a hex string — that is what lets an
   * opacity modifier like `bg-surface/40` work at all.
   */
  it('emit space-separated rgb channels, not hex', () => {
    expect(paletteVariables(DARK)['--color-accent']).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });

  it('name every token', () => {
    const variables = paletteVariables(LIGHT);

    for (const token of COLOR_TOKENS) {
      expect(variables[`--color-${token}`], token).toBeDefined();
    }
  });

  it('converts a known colour correctly', () => {
    expect(
      paletteVariables({ ...DARK, accent: '#ffc93c' } as Record<ColorToken, string>)[
        '--color-accent'
      ],
    ).toBe('255 201 60');
  });
});

describe('the stylesheets that carry the palette', () => {
  const sheets = [
    ['web', resolve(__dirname, '../../../apps/web/src/app/globals.css')],
    ['mobile', resolve(__dirname, '../../../apps/mobile/global.css')],
  ] as const;

  /*
   * The variables are written into two stylesheets because native cannot
   * @import one shared file through NativeWind. Duplication is the price, and
   * this is what stops the copies drifting: a colour changed in the palette and
   * not in a stylesheet would leave one platform on the old value, which is
   * exactly the kind of thing nobody notices until it ships.
   */
  it.each(sheets)('has %s carrying every dark value', (_name, path) => {
    const css = readFileSync(path, 'utf8');

    for (const [name, value] of Object.entries(paletteVariables(DARK))) {
      expect(css, name).toContain(`${name}: ${value};`);
    }
  });

  it.each(sheets)('has %s carrying every light value', (_name, path) => {
    const css = readFileSync(path, 'utf8');

    for (const [name, value] of Object.entries(paletteVariables(LIGHT))) {
      expect(css, name).toContain(`${name}: ${value};`);
    }
  });

  /*
   * :root and .dark carry the same specificity, so the later block wins. Dark
   * has to come second or it never applies at all â and that failure is
   * invisible in a unit test of the palette itself, because the values would
   * all still be correct.
   */
  it.each(sheets)('has %s ordering the dark override after the base', (_name, path) => {
    const css = readFileSync(path, 'utf8');

    expect(css.indexOf(':root')).toBeLessThan(css.indexOf('.dark'));
  });
});
