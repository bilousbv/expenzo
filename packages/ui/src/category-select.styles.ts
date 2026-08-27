import type { CategoryOption } from './category-picker.styles';
import { fieldInputClass, fieldLabelClass } from './field.styles';

export interface CategorySelectProps {
  options: CategoryOption[];
  /** The selected category id, or undefined for "no category". */
  value?: string;
  onChange: (id: string | undefined) => void;
  label?: string;
  /** Shown as the empty choice. Selecting it clears the category. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

/**
 * The value used for "no category".
 *
 * An empty string rather than a sentinel word, so a real category slug can
 * never collide with it — and so the web `<select>` needs no translation
 * between its own empty value and undefined.
 */
export const NO_CATEGORY = '';

export function selectTriggerClass(disabled: boolean): string {
  return fieldInputClass(false, disabled ? 'opacity-50' : undefined);
}

export const selectLabelClass = fieldLabelClass;

/** Resolves a chosen value back to an id, treating the empty choice as none. */
export function toCategoryId(value: string): string | undefined {
  return value === NO_CATEGORY ? undefined : value;
}
