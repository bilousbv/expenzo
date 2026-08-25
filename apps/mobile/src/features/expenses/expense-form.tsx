import { createExpenseInput, type CreateExpenseInput } from '@expenzo/domain';
import { AmountField, Button, CategoryPicker, type CategoryOption } from '@expenzo/ui';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export interface ExpenseFormProps {
  currency: string;
  /** Today's date in the household timezone, resolved by the caller. */
  today: string;
  categories: CategoryOption[];
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
  onCreate,
  disabled = false,
  autoFocusAmount = true,
}: ExpenseFormProps) {
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [occurredOn, setOccurredOn] = useState(today);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [personal, setPersonal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (pending || disabled) return;

    setError(null);

    const parsed = createExpenseInput.safeParse({
      amountMinor,
      currency,
      occurredOn,
      visibility: personal ? 'personal' : 'shared',
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
      <AmountField
        key={amountKey}
        currency={currency}
        onChange={setAmountMinor}
        disabled={disabled}
        autoFocus={autoFocusAmount}
      />

      <Text className="text-sm font-medium text-content-muted">Date</Text>
      <TextInput
        testID="expense-date"
        value={occurredOn}
        onChangeText={setOccurredOn}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD"
        className={inputClass}
      />

      <CategoryPicker
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        label="Category"
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

      {/* Shared by default: a household ledger is the point, so keeping an
          expense to yourself is the deliberate choice. */}
      <Pressable
        testID="expense-personal"
        accessibilityRole="switch"
        accessibilityState={{ checked: personal }}
        accessibilityLabel="Personal"
        onPress={() => setPersonal((value) => !value)}
        className="flex-row items-center gap-2"
      >
        <View
          className={`h-5 w-5 rounded border ${
            personal ? 'border-brand-600 bg-brand-600' : 'border-brand-200 bg-white'
          }`}
        />
        <Text className="text-sm text-content">Personal</Text>
      </Pressable>

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
