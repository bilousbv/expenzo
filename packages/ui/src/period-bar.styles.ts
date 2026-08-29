import { cn } from './cn';

export interface PeriodBarProps {
  /** The name in the centre, already translated. */
  label: string;
  /** The exact range beneath it, already formatted. */
  dates: string;
  /**
   * Steps the period by whole months. Absent means the arrows are not shown:
   * the period is not a single month, and stepping an arbitrary range by a
   * month is not a thing anybody asked for.
   */
  onStep?: (months: number) => void;
  onOpen: () => void;
  /** Accessible name for the centre control, which opens the picker. */
  openLabel: string;
  previousLabel: string;
  nextLabel: string;
  className?: string;
  testID?: string;
}

export const periodBarClass = (extra?: string) =>
  cn('rounded-card bg-surface flex-row items-center justify-between gap-2 px-2 py-2', extra);

export const periodArrowClass = 'rounded-pill h-9 w-9 items-center justify-center bg-surface-muted';

export const periodArrowGlyphClass = 'text-content text-base font-semibold';

/** The centre control. Grows so the label stays centred between the arrows. */
export const periodCentreClass = 'flex-1 items-center justify-center py-1';

export const periodLabelClass = 'text-content text-base font-semibold';

export const periodDatesClass = 'text-content-muted text-xs';

/**
 * A placeholder the width of an arrow, used when the arrows are hidden.
 *
 * Without it the centre label shifts sideways the moment a custom range is
 * chosen, which reads as the layout breaking rather than as a control going
 * away.
 */
export const periodArrowSpacerClass = 'h-9 w-9';
