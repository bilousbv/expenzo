/**
 * The two colour schemes, and the CSS variables that carry them.
 *
 * Every token is defined twice and swapped at runtime by redefining variables
 * on the root element, which is what lets one set of class names — `bg-surface`,
 * `text-content` — serve both schemes on both platforms. Tailwind maps each
 * token to `rgb(var(--color-x) / <alpha-value>)`, so the values here are
 * unwrapped into channels rather than left as hex; that is what makes an
 * opacity modifier such as `bg-surface/40` work.
 *
 * Dark is the default. The palette is taken from the reference: near-black
 * surfaces with a violet cast, violet as the brand, and amber for every call to
 * action.
 */

export const COLOR_TOKENS = [
  /** The page behind the cards. */
  'background',
  /** A card. Always distinct from the background, or there are no cards. */
  'surface',
  /** Inset areas inside a card — input fills, inactive segments. */
  'surface-muted',
  /** Borders and dividers. */
  'border',
  'content',
  'content-muted',
  /** Text on a brand-coloured fill. */
  'content-inverse',
  /** Text on the amber action colour, which is too bright to take white. */
  'content-on-accent',
  'brand',
  'brand-muted',
  /** The call to action: the add button, save, every progress bar. */
  'accent',
  'accent-muted',
  /** Money arriving. */
  'positive',
  /** Money leaving, and overspend. */
  'negative',
  'link',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export type Palette = Record<ColorToken, string>;

export const DARK: Palette = {
  background: '#0e0b16',
  surface: '#191527',
  'surface-muted': '#241f38',
  border: '#2e2844',
  content: '#f4f2fa',
  'content-muted': '#a49fc0',
  'content-inverse': '#0e0b16',
  'content-on-accent': '#2a1f05',
  brand: '#8b6bff',
  'brand-muted': '#3a2d6b',
  accent: '#ffc93c',
  'accent-muted': '#4a3a12',
  positive: '#3ddc84',
  negative: '#ff6b6b',
  link: '#9d8bff',
};

export const LIGHT: Palette = {
  background: '#f4f3f9',
  surface: '#ffffff',
  'surface-muted': '#eeecf6',
  border: '#dedaee',
  content: '#171326',
  'content-muted': '#5f5a75',
  'content-inverse': '#ffffff',
  'content-on-accent': '#2a1f05',
  brand: '#5b3fd6',
  'brand-muted': '#e4dcff',
  accent: '#ffc93c',
  'accent-muted': '#fff0c9',
  positive: '#0f7a3d',
  negative: '#c0322b',
  link: '#5b3fd6',
};

/**
 * The channels of a `#rrggbb` value, space separated.
 *
 * Tailwind needs them unwrapped so it can insert an alpha of its own; a hex
 * string in the variable would make every `/40` modifier silently do nothing.
 */
function channels(hex: string): string {
  const value = parseInt(hex.slice(1), 16);

  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export function paletteVariables(palette: Palette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([token, hex]) => [`--color-${token}`, channels(hex)]),
  );
}

/** The same thing as a CSS declaration block, for a stylesheet to paste in. */
export function paletteCss(palette: Palette): string {
  return Object.entries(paletteVariables(palette))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}
