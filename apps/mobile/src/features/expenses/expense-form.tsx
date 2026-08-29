import { createExpenseInput, VALIDATION_PARAMS, type CreateExpenseInput } from '@expenzo/domain';
import {
  AmountField,
  Button,
  CategorySelect,
  CurrencySelect,
  fieldInputClass,
  type CategoryOption,
} from '@expenzo/ui';
import { useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
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

export function ExpenseForm({
  currency,
  today,
  categories,
  currencies,
  onCreate,
  disabled = false,
  autoFocusAmount = true,
}: ExpenseFormProps) {
  const { t } = useTranslation();
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

  /*
   * Money arriving has no shop, no category of spending, and nothing to
   * disambiguate it from the purchase next to it. Asking would be asking a
   * question with no answer.
   */
  const recordingIncome = direction === 'income';

  async function handleSubmit() {
    if (pending || disabled) return;

    setError(null);

    const parsed = createExpenseInput.safeParse({
      amountMinor,
      currency: chosenCurrency,
      direction,
      occurredOn,
      /*
       * Income carries none of the three. They are not merely hidden: a
       * merchant typed before switching direction must not travel into the
       * saved row where nobody can see it to correct it.
       */
      categoryId: recordingIncome ? undefined : categoryId,
      merchant: recordingIncome ? undefined : merchant,
      note: recordingIncome ? undefined : note,
    });

    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? 'expenses.errors.invalid', VALIDATION_PARAMS));
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
      setError(cause instanceof Error ? cause.message : t('expenses.errors.addFailed'));
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
        accessibilityLabel={t('expenses.direction')}
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
            {t(option === 'spend' ? 'expenses.spending' : 'expenses.incomeDirection')}
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

      <Text className="text-sm font-medium text-content-muted">{t('expenses.date')}</Text>
      <TextInput
        testID="expense-date"
        value={occurredOn}
        onChangeText={setOccurredOn}
        autoCapitalize="none"
        placeholder={t('expenses.datePlaceholder')}
        className={fieldInputClass()}
      />

      {/* Spending only. Income has no shop and no category of spending, and a
          note exists to tell one purchase from another. */}
      {recordingIncome ? null : (
        <>
          <CategorySelect
            options={categories}
            value={categoryId}
            onChange={setCategoryId}
            disabled={disabled}
          />

          <Text className="text-sm font-medium text-content-muted">{t('expenses.merchant')}</Text>
          <TextInput
            testID="expense-merchant"
            value={merchant}
            onChangeText={setMerchant}
            placeholder={t('expenses.merchantPlaceholder')}
            className={fieldInputClass()}
          />

          <Text className="text-sm font-medium text-content-muted">{t('expenses.note')}</Text>
          <TextInput
            testID="expense-note"
            value={note}
            onChangeText={setNote}
            className={fieldInputClass()}
          />
        </>
      )}

      <Button testID="expense-submit" disabled={pending || disabled} onPress={handleSubmit}>
        {t(pending ? 'expenses.adding' : 'expenses.addExpense')}
      </Button>

      {error ? (
        <Text testID="expense-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
