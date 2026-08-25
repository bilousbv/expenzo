import { formatMinorUnits, parseAmountInput } from '@expenzo/domain';

import { cn } from './cn';

export interface AmountFieldProps {
  currency: string;
  /** Initial amount in minor units. The field owns the text after that. */
  valueMinor?: number | null;
  /** Called with minor units, or null while the text is not a number. */
  onChange: (amountMinor: number | null) => void;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

export function amountInputClass(invalid: boolean, extra?: string): string {
  return cn(
    'rounded-card text-content border bg-white px-4 py-3 text-2xl',
    invalid ? 'border-red-500' : 'border-brand-100',
    extra,
  );
}

export const amountPreviewClass = 'text-content-muted text-sm';
export const amountErrorClass = 'text-sm text-red-600';

/**
 * The text the field should start with for a given stored amount.
 *
 * Empty rather than "0.00" for a new expense: a zero sitting in the box has to
 * be deleted before anything can be typed.
 */
export function initialAmountText(valueMinor: number | null | undefined, currency: string): string {
  return valueMinor === null || valueMinor === undefined
    ? ''
    : formatMinorUnits(valueMinor, currency);
}

export interface AmountReading {
  minor: number | null;
  /** True while the text is a plausible prefix of a number rather than a mistake. */
  incomplete: boolean;
}

/** A lone separator, or digits with a trailing separator: "12." or "," so far. */
const IN_PROGRESS = /^[\d\s.,']*[.,]$/;

/**
 * Reads the field's text, distinguishing "not a number yet" from "not a number".
 *
 * Every decimal passes through "12." on the way to "12.5". Treating that as an
 * error means the field is red for most of the time it is being used.
 */
export function readAmount(text: string, currency: string): AmountReading {
  const trimmed = text.trim();

  if (!trimmed) return { minor: null, incomplete: true };

  const minor = parseAmountInput(trimmed, currency);

  if (minor !== null) return { minor, incomplete: false };

  return { minor: null, incomplete: IN_PROGRESS.test(trimmed) };
}
