import { useEffect, useId, useRef, useState } from 'react';

import {
  amountErrorClass,
  amountInputClass,
  amountPreviewClass,
  initialAmountText,
  readAmount,
  type AmountFieldProps,
} from './amount-field.styles';
import { formatCurrency } from './format';

/** Web implementation. Metro picks `amount-field.native.tsx` instead. */
export function AmountField({
  currency,
  valueMinor,
  onChange,
  label = 'Amount',
  autoFocus = false,
  disabled = false,
  className,
  testID = 'amount-field',
}: AmountFieldProps) {
  const inputId = useId();
  const [text, setText] = useState(() => initialAmountText(valueMinor, currency));
  const [touched, setTouched] = useState(false);

  const reading = readAmount(text, currency);
  const showError = touched && !reading.incomplete && reading.minor === null;

  // The reading is reported from an effect rather than from the change handler,
  // because the currency is part of it: the exponent decides what the same text
  // means. "1000" is 100000 minor units in dollars and 1000 in yen, so a
  // currency change with nothing retyped still has to reach the parent.
  // Undefined rather than the first reading, so mounting reports too: a parent
  // holding a stale amount from a previous open is worse than a redundant call.
  const reported = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (reported.current === reading.minor) return;

    reported.current = reading.minor;
    onChange(reading.minor);
  }, [reading.minor, onChange]);

  return (
    <div className={className}>
      <label htmlFor={inputId} className="text-content-muted text-sm font-medium">
        {label}
      </label>

      <input
        id={inputId}
        // Deliberately not type="number": its spinner steps by a whole unit,
        // and a stray scroll over a focused field changes the amount silently.
        // inputMode gets the decimal keypad on a phone without any of that.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-testid={testID}
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={showError ? true : undefined}
        placeholder="0"
        className={amountInputClass(showError)}
      />

      {/* The grouping convention has to guess between 1,234 and 1.234. Showing
          the reading back is what makes guessing acceptable. */}
      {reading.minor !== null ? (
        <p data-testid="amount-preview" className={amountPreviewClass}>
          {formatCurrency(reading.minor, currency)}
        </p>
      ) : null}

      {showError ? (
        <p role="alert" data-testid="amount-error" className={amountErrorClass}>
          That is not an amount in {currency}.
        </p>
      ) : null}
    </div>
  );
}
