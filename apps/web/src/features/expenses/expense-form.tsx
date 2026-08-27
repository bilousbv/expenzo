'use client';

import { createExpenseInput, VALIDATION_PARAMS, type CreateExpenseInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  AmountField,
  buttonContainerClass,
  buttonLabelClass,
  CategorySelect,
  CurrencySelect,
  fieldInputClass,
  type CategoryOption,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export interface ExpenseFormProps {
  /** The household's base currency, and the default for a new expense. */
  currency: string;
  timeZone: string;
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
}

export function ExpenseForm({
  currency,
  today,
  categories,
  currencies,
  onCreate,
  disabled = false,
}: ExpenseFormProps) {
  const { t } = useTranslation();
  const dateId = useId();
  const merchantId = useId();
  const noteId = useId();

  // The amount field owns its own text; this is only the parsed reading. It is
  // keyed so a successful add resets the text as well as the number.
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

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
      setError(t(parsed.error.issues[0]?.message ?? 'expenses.errors.invalid', VALIDATION_PARAMS));
      return;
    }

    setPending(true);
    try {
      await onCreate(parsed.data);

      // Only the amount is cleared. Adding three coffees from the same place on
      // the same day should not mean retyping the merchant three times.
      setAmountMinor(null);
      setAmountKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('expenses.errors.addFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      {/* Spending or income. A direction rather than a signed amount: the
          amount column is constrained positive, and carrying both a sign and a
          direction invites rows where the two disagree. */}
      <div role="radiogroup" aria-label={t('expenses.direction')} className="flex flex-row gap-2">
        {(['spend', 'income'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={direction === option}
            data-testid={`direction-${option}`}
            onClick={() => setDirection(option)}
            className={buttonContainerClass(direction === option ? 'primary' : 'secondary', 'sm')}
          >
            <span
              className={buttonLabelClass(direction === option ? 'primary' : 'secondary', 'sm')}
            >
              {t(option === 'spend' ? 'expenses.spending' : 'expenses.incomeDirection')}
            </span>
          </button>
        ))}
      </div>

      <AmountField
        key={amountKey}
        currency={chosenCurrency}
        onChange={setAmountMinor}
        disabled={disabled}
        autoFocus
      />

      {/* Only worth rendering when there is something to choose. Before the
          first rate sync there is only the household's own currency, and a
          dropdown holding one item is furniture. */}
      {currencies && currencies.length > 1 ? (
        <CurrencySelect
          currencies={currencies}
          value={chosenCurrency}
          onChange={setChosenCurrency}
          disabled={disabled}
        />
      ) : null}

      <label htmlFor={dateId} className="text-sm font-medium text-content-muted">
        {t('expenses.date')}
      </label>
      <input
        id={dateId}
        name="occurredOn"
        type="date"
        value={occurredOn}
        onChange={(event) => setOccurredOn(event.target.value)}
        className={fieldInputClass()}
      />

      <CategorySelect
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        disabled={disabled}
      />

      <label htmlFor={merchantId} className="text-sm font-medium text-content-muted">
        {t('expenses.merchant')}
      </label>
      <input
        id={merchantId}
        name="merchant"
        value={merchant}
        onChange={(event) => setMerchant(event.target.value)}
        placeholder={t('expenses.merchantPlaceholder')}
        className={fieldInputClass()}
      />

      <label htmlFor={noteId} className="text-sm font-medium text-content-muted">
        {t('expenses.note')}
      </label>
      <input
        id={noteId}
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className={fieldInputClass()}
      />

      <button
        type="submit"
        disabled={pending || disabled}
        className={buttonContainerClass('primary', 'md', pending || disabled)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'expenses.adding' : 'expenses.addExpense')}
        </span>
      </button>

      {error ? (
        <p role="alert" data-testid="expense-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
