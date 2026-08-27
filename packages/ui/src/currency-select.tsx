import { useId } from 'react';

import { cn } from './cn';
import { fieldGroupClass } from './field.styles';

import {
  currencyOptions,
  selectLabelClass,
  selectTriggerClass,
  type CurrencySelectProps,
} from './currency-select.styles';

/**
 * Web implementation. Metro picks `currency-select.native.tsx` instead.
 *
 * A real `<select>`, for the same reasons as the category one: keyboard
 * behaviour, type-ahead and the platform picker on a phone browser come free.
 */
export function CurrencySelect({
  currencies,
  value,
  onChange,
  label = 'Currency',
  disabled = false,
  className,
  testID = 'currency-select',
}: CurrencySelectProps) {
  const selectId = useId();

  return (
    <div className={cn(fieldGroupClass, className)}>
      <label htmlFor={selectId} className={selectLabelClass}>
        {label}
      </label>

      <select
        id={selectId}
        data-testid={testID}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectTriggerClass(disabled)}
      >
        {currencyOptions(currencies, value).map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
}
