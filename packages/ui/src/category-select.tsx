import { useId } from 'react';

import {
  NO_CATEGORY,
  selectLabelClass,
  selectTriggerClass,
  toCategoryId,
  type CategorySelectProps,
} from './category-select.styles';

/**
 * Web implementation. Metro picks `category-select.native.tsx` instead.
 *
 * A real `<select>` rather than a custom listbox: keyboard behaviour, type-
 * ahead and the platform picker on a phone browser all come free, and a
 * hand-rolled replacement gets each of them subtly wrong.
 */
export function CategorySelect({
  options,
  value,
  onChange,
  label = 'Category',
  placeholder = 'No category',
  disabled = false,
  className,
  testID = 'category-select',
}: CategorySelectProps) {
  const selectId = useId();

  return (
    <div className={className}>
      <label htmlFor={selectId} className={selectLabelClass}>
        {label}
      </label>

      <select
        id={selectId}
        data-testid={testID}
        disabled={disabled}
        value={value ?? NO_CATEGORY}
        onChange={(event) => onChange(toCategoryId(event.target.value))}
        className={selectTriggerClass(disabled)}
      >
        <option value={NO_CATEGORY}>{placeholder}</option>

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
