import { cn } from './cn';

/** Category colours are free-form hex in the database, so a swatch is the only
 *  way to show one. Tailwind cannot generate a class for an arbitrary hex at
 *  build time, which is why this one value is an inline style. */
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Matches the `uncategorized` seed colour. */
const FALLBACK = '#9ca3af';

export interface CategoryDotStyle {
  backgroundColor: string;
}

/**
 * Colours arrive from the database, where a row could have been written by a
 * migration, a seed, or an older client. Anything that is not a six-digit hex
 * is replaced rather than passed through — on web this string lands in a style
 * attribute.
 */
export function categoryDotStyle(color: string | null | undefined): CategoryDotStyle {
  return { backgroundColor: color && HEX.test(color) ? color.toLowerCase() : FALLBACK };
}

/**
 * Selection is shown by border and weight, not by the swatch. The swatch is the
 * category's own colour and cannot also carry state.
 */
export function categoryChipClass(selected: boolean, extra?: string): string {
  return cn(
    'flex-row items-center gap-2 rounded-full border px-3 py-2',
    selected ? 'border-brand-600 bg-brand-50' : 'border-brand-100 bg-surface',
    extra,
  );
}

export function categoryChipLabelClass(selected: boolean): string {
  return cn('text-sm', selected ? 'text-brand-700 font-semibold' : 'text-content');
}

export function categoryDotClass(): string {
  return 'h-3 w-3 rounded-full';
}
