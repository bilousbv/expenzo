import { cn } from './cn';

export interface SavedCardProps {
  /** Income minus spending for the period, in minor units. */
  savedMinor: number;
  /** That figure, already converted and formatted. */
  savedLabel: string;
  title: string;
  /** The one line under the title saying what the figure is. */
  explainer: string;
  className?: string;
  testID?: string;
}

/**
 * Saving or running down.
 *
 * Zero counts as saving rather than as a loss: a period that exactly broke even
 * has not lost anything, and colouring it red would read as a warning about
 * nothing.
 */
export function isSaving(savedMinor: number): boolean {
  return savedMinor >= 0;
}

/** The arrow beside the figure. Direction is the information; colour repeats it. */
export function savedGlyph(savedMinor: number): string {
  return isSaving(savedMinor) ? '↗' : '↘';
}

export const savedCardClass = (extra?: string) =>
  cn('gap-gutter rounded-card bg-surface p-gutter flex-row items-center', extra);

/** A tinted circle, matching the icon tiles on the rest of the app. */
export const savedIconClass = 'rounded-pill h-11 w-11 items-center justify-center bg-brand-muted';

export const savedIconGlyphClass = 'text-brand text-lg font-semibold';

export const savedTitleClass = 'text-content text-base font-semibold';

export const savedExplainerClass = 'text-content-muted text-xs';

/** Green while saving, red while running down — the same pairing as a row. */
export const savedAmountClass = (savedMinor: number) =>
  cn('text-lg font-semibold', isSaving(savedMinor) ? 'text-positive' : 'text-negative');
