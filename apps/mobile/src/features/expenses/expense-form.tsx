import { createExpenseInput, type CreateExpenseInput } from '@expenzo/domain';
import {
  AmountField,
  Button,
  CategorySelect,
  CurrencySelect,
  type CategoryOption,
} from '@expenzo/ui';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export interface ExpenseFormProps {
  /** The household's base currency, and the default for a new expense. */
  currency: string;
  /** Today's date in the household timezone, resolved by the caller. */
  today: string;
  categories: CategoryOption[];
  /**
   * Everything the rate table can convert. Absent, or holding only the
   * household's own currency, means there is nothing to choose and no control
   * is rendered.
   */
  currencies?: string[];
  onCreate: (input: CreateExpenseInput) => Promise<void>;
  disabled?: boolean;
  /** M6 opens this screen from a wallet payment, where only the amount is left to type. */
  autoFocusAmount?: boolean;
}

const inputClass = 'rounded-card border border-brand-100 bg-white px-4 py-3 text-content';

export function ExpenseForm({
  currency,
  today,
  categories,
  currencies,
  onCreate,
  disabled = false,
  autoFocusAmount = true,
}: ExpenseFormProps) {
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [direction, setDirection] = useState<'spend' | 'income'>('spend');
  // Kept after a save, like the merchant: entering one foreign expense usually
  // means entering several.
  const [chosenCurrency, setChosenCurrency] = useState(currency);
  const [occurredOn, setOccurredOn] = useState(today);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (pending || disabled) return;

    setError(null);

    const parsed = createExpenseInput.safeParse({
      amountMinor,
      currency: chosenCurrency,
      direction,
      occurredOn,
      categoryId,
      merchant,
      note,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the expense and try again.');
      return;
    }

    setPending(true);
    try {
      await onCreate(parsed.data);

      // Only the amount is cleared. Three coffees from the same place on the
      // same day should not mean retyping the merchant three times.
      setAmountMinor(null);
      setAmountKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the expense.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      {/* Spending or income. A direction rather than a signed amount: the
          amount column is constrained positive, and carrying both a sign and a
          direction invites rows where the two disagree. */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Direction"
        className="flex-row gap-2"
      >
        {(['spend', 'income'] as const).map((option) => (
          <Button
            key={option}
            testID={`direction-${option}`}
            variant={direction === option ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setDirection(option)}
          >
            {option === 'spend' ? 'Spending' : 'Income'}
          </Button>
        ))}
      </View>

      <AmountField
        key={amountKey}
        currency={chosenCurrency}
        onChange={setAmountMinor}
        disabled={disabled}
        autoFocus={autoFocusAmount}
      />

      {/* Only worth rendering when there is something to choose. Before the
          first rate sync there is only the household's own currency, and a
          picker holding one item is furniture. */}
      {currencies && currencies.length > 1 ? (
        <CurrencySelect
          currencies={currencies}
          value={chosenCurrency}
          onChange={setChosenCurrency}
          disabled={disabled}
        />
      ) : null}

      <Text className="text-sm font-medium text-content-muted">Date</Text>
      <TextInput
        testID="expense-date"
        value={occurredOn}
        onChangeText={setOccurredOn}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD"
        className={inputClass}
      />

      <CategorySelect
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        disabled={disabled}
      />

      <Text className="text-sm font-medium text-content-muted">Merchant</Text>
      <TextInput
        testID="expense-merchant"
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Blue Bottle"
        className={inputClass}
      />

      <Text className="text-sm font-medium text-content-muted">Note</Text>
      <TextInput testID="expense-note" value={note} onChangeText={setNote} className={inputClass} />

      <Button testID="expense-submit" disabled={pending || disabled} onPress={handleSubmit}>
        {pending ? 'Adding…' : 'Add expense'}
      </Button>

      {error ? (
        <Text testID="expense-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
