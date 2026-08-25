import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import {
  amountErrorClass,
  amountInputClass,
  amountPreviewClass,
  initialAmountText,
  readAmount,
  type AmountFieldProps,
} from './amount-field.styles';
import { formatCurrency } from './format';

/** React Native implementation, resolved by Metro through the `.native` suffix. */
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
  const [text, setText] = useState(() => initialAmountText(valueMinor, currency));
  const [touched, setTouched] = useState(false);

  const reading = readAmount(text, currency);
  const showError = touched && !reading.incomplete && reading.minor === null;

  function handleChange(next: string) {
    setText(next);
    onChange(readAmount(next, currency).minor);
  }

  return (
    <View className={className}>
      <Text className="text-content-muted text-sm font-medium">{label}</Text>

      <TextInput
        testID={testID}
        // decimal-pad rather than numeric: it carries the separator key, and on
        // iOS it omits the punctuation that cannot appear in an amount anyway.
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        editable={!disabled}
        value={text}
        onChangeText={handleChange}
        onBlur={() => setTouched(true)}
        placeholder="0"
        className={amountInputClass(showError)}
      />

      {/* The grouping convention has to guess between 1,234 and 1.234. Showing
          the reading back is what makes guessing acceptable. */}
      {reading.minor !== null ? (
        <Text testID="amount-preview" className={amountPreviewClass}>
          {formatCurrency(reading.minor, currency)}
        </Text>
      ) : null}

      {showError ? (
        <Text testID="amount-error" className={amountErrorClass}>
          That is not an amount in {currency}.
        </Text>
      ) : null}
    </View>
  );
}
