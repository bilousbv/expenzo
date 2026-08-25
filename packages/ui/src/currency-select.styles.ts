import { selectLabelClass, selectTriggerClass } from './category-select.styles';

export interface CurrencySelectProps {
  /** The codes the rate table can convert, usually including the household's. */
  currencies: string[];
  /** Always set: an expense is always in some currency. */
  value: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

/**
 * The list actually rendered.
 *
 * The current value is folded in even when the feed does not quote it: a
 * household's own currency needs no rate to convert into itself, so it is a
 * legitimate choice the rate table may know nothing about. Dropping it would
 * leave the control showing a currency the user never picked.
 */
export function currencyOptions(currencies: string[], value: string): string[] {
  return [...new Set([...currencies, value])].sort();
}

export { selectLabelClass, selectTriggerClass };
