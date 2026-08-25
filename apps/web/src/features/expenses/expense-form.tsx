'use client';

import { createExpenseInput, type CreateExpenseInput } from '@expenzo/domain';
import {
  AmountField,
  buttonContainerClass,
  buttonLabelClass,
  CategoryPicker,
  type CategoryOption,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export interface ExpenseFormProps {
  currency: string;
  timeZone: string;
  /** Today's date in the household timezone, resolved by the caller. */
  today: string;
  categories: CategoryOption[];
  onCreate: (input: CreateExpenseInput) => Promise<void>;
  disabled?: boolean;
}

const inputClass =
  'rounded-card border border-brand-100 bg-white px-4 py-3 text-content outline-none focus:border-brand-500';

export function ExpenseForm({
  currency,
  today,
  categories,
  onCreate,
  disabled = false,
}: ExpenseFormProps) {
  const dateId = useId();
  const merchantId = useId();
  const noteId = useId();
  const personalId = useId();

  // The amount field owns its own text; this is only the parsed reading. It is
  // keyed so a successful add resets the text as well as the number.
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [occurredOn, setOccurredOn] = useState(today);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [personal, setPersonal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

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

      // Only the amount is cleared. Adding three coffees from the same place on
      // the same day should not mean retyping the merchant three times.
      setAmountMinor(null);
      setAmountKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the expense.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <AmountField
        key={amountKey}
        currency={currency}
        onChange={setAmountMinor}
        disabled={disabled}
        autoFocus
      />

      <label htmlFor={dateId} className="text-sm font-medium text-content-muted">
        Date
      </label>
      <input
        id={dateId}
        name="occurredOn"
        type="date"
        value={occurredOn}
        onChange={(event) => setOccurredOn(event.target.value)}
        className={inputClass}
      />

      <CategoryPicker
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        label="Category"
        disabled={disabled}
      />

      <label htmlFor={merchantId} className="text-sm font-medium text-content-muted">
        Merchant
      </label>
      <input
        id={merchantId}
        name="merchant"
        value={merchant}
        onChange={(event) => setMerchant(event.target.value)}
        placeholder="Blue Bottle"
        className={inputClass}
      />

      <label htmlFor={noteId} className="text-sm font-medium text-content-muted">
        Note
      </label>
      <input
        id={noteId}
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className={inputClass}
      />

      {/* Shared by default: a household ledger is the point, so keeping an
          expense to yourself is the deliberate choice. */}
      <label htmlFor={personalId} className="flex flex-row items-center gap-2 text-sm text-content">
        <input
          id={personalId}
          name="personal"
          type="checkbox"
          checked={personal}
          onChange={(event) => setPersonal(event.target.checked)}
        />
        Personal
      </label>

      <button
        type="submit"
        disabled={pending || disabled}
        className={buttonContainerClass('primary', 'md', pending || disabled)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {pending ? 'Adding…' : 'Add expense'}
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
