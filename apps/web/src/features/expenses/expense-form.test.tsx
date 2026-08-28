import type { CategoryOption } from '@expenzo/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExpenseForm } from './expense-form';

// Real uuids, because createExpenseInput validates the shape of the category
// id. A readable placeholder here would pass the click and fail validation.
const GROCERIES = '11111111-1111-4111-8111-111111111111';
const DINING = '22222222-2222-4222-8222-222222222222';

const categories: CategoryOption[] = [
  { id: GROCERIES, name: 'Groceries', color: '#337dff', icon: null },
  { id: DINING, name: 'Dining out', color: '#f97316', icon: null },
];

function renderForm(onCreate = vi.fn().mockResolvedValue(undefined), currencies?: string[]) {
  render(
    <ExpenseForm
      currency="USD"
      timeZone="Europe/Madrid"
      today="2026-08-25"
      categories={categories}
      currencies={currencies}
      onCreate={onCreate}
    />,
  );

  return onCreate;
}

const ADD = /add expense/i;

describe('ExpenseForm', () => {
  it('submits an amount and a date', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMinor: 1250,
          currency: 'USD',
          occurredOn: '2026-08-25',
        }),
      ),
    );
  });

  // The date defaults to today in the household's timezone, not the browser's.
  // An expense entered at 23:30 in Madrid must not be filed as tomorrow because
  // the machine happens to be on UTC.
  it('defaults the date to today in the household timezone', () => {
    renderForm();

    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-25');
  });

  it('sends the chosen category', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.selectOptions(screen.getByLabelText('Category'), DINING);
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: DINING })),
    );
  });

  it('sends no category when none is chosen', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).not.toHaveProperty('categoryId', expect.any(String));
  });

  it('sends the merchant and note', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.type(screen.getByLabelText('Merchant'), '  Blue Bottle  ');
    await userEvent.type(screen.getByLabelText('Note'), 'Standing meeting');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ merchant: 'Blue Bottle', note: 'Standing meeting' }),
      ),
    );
  });

  // Every member of a household sees every expense, so there is nothing to
  // choose here any more and nothing to send.
  it('offers no privacy control and sends no visibility', async () => {
    const onCreate = renderForm();

    expect(screen.queryByLabelText('Personal')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).not.toHaveProperty('visibility');
  });

  it('refuses to submit without an amount', async () => {
    const onCreate = renderForm();

    await userEvent.click(screen.getByRole('button', { name: ADD }));

    expect(await screen.findByTestId('expense-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Zero is a number the amount field will happily parse, and an expense of
  // nothing is not an expense. The column's check constraint agrees.
  it('refuses a zero amount', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '0');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    expect(await screen.findByTestId('expense-error')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('clears the amount after a successful add, ready for the next one', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(''));
  });

  it('keeps what was typed when the add fails', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('permission denied for table expenses'));
    renderForm(onCreate);

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.type(screen.getByLabelText('Merchant'), 'Blue Bottle');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    expect(await screen.findByTestId('expense-error')).toHaveTextContent(/permission denied/i);
    expect(screen.getByLabelText('Merchant')).toHaveValue('Blue Bottle');
  });

  it('ignores a second submit while the first is in flight', async () => {
    let release = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderForm(onCreate);

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    const submit = screen.getByRole('button', { name: /add expense|adding/i });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(onCreate).toHaveBeenCalledTimes(1);
    release();
  });

  // Income and spending share one form; the direction carries the meaning and
  // the amount stays positive either way.
  it('defaults to spending', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ direction: 'spend' })),
    );
  });

  // A household with one currency has nothing to choose, and a dropdown with a
  // single item in it is furniture.
  it('offers no currency control when only the household currency is available', () => {
    renderForm();

    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
  });

  it('defaults to the household currency when others are available', () => {
    renderForm(vi.fn().mockResolvedValue(undefined), ['EUR', 'GBP', 'USD']);

    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  });

  // The expense keeps the currency it was entered in. The conversion into the
  // household's base currency happens in the database, once, at write time.
  it('sends the chosen currency rather than the household one', async () => {
    const onCreate = renderForm(vi.fn().mockResolvedValue(undefined), ['EUR', 'GBP', 'USD']);

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');
    await userEvent.type(screen.getByLabelText('Amount'), '20');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', amountMinor: 2000 }),
      ),
    );
  });

  // Entering one foreign expense usually means entering several, and the
  // preview has to keep reading in the currency being typed.
  it('keeps the chosen currency after a successful add', async () => {
    renderForm(vi.fn().mockResolvedValue(undefined), ['EUR', 'USD']);

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');
    await userEvent.type(screen.getByLabelText('Amount'), '20');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(''));
    expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
  });

  it('records income without making the amount negative', async () => {
    const onCreate = renderForm();

    await userEvent.click(screen.getByTestId('direction-income'));
    await userEvent.type(screen.getByLabelText('Amount'), '2000');
    await userEvent.click(screen.getByRole('button', { name: ADD }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'income', amountMinor: 200000 }),
      ),
    );
  });
});

describe('ExpenseForm, recording income', () => {
  /*
   * Income is money arriving, and the three fields that describe a purchase
   * have nothing to say about it: there is no shop, no category of spending,
   * and the note was only ever there to disambiguate one purchase from
   * another. Leaving them on the form asks a question with no answer.
   */
  it('drops the fields that only describe a purchase', async () => {
    renderForm();

    expect(screen.getByLabelText('Merchant')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('direction-income'));

    expect(screen.queryByLabelText('Merchant')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-select')).not.toBeInTheDocument();
  });

  // The amount is the whole point, and the date and currency still apply.
  it('keeps the amount, the date and the currency', async () => {
    renderForm(vi.fn().mockResolvedValue(undefined), ['EUR', 'USD']);

    await userEvent.click(screen.getByTestId('direction-income'));

    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByTestId('currency-select')).toBeInTheDocument();
  });

  it('submits income with no category, merchant or note', async () => {
    const onCreate = renderForm();

    await userEvent.click(screen.getByTestId('direction-income'));
    await userEvent.type(screen.getByLabelText('Amount'), '1500');
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      direction: 'income',
      categoryId: undefined,
      merchant: undefined,
      note: undefined,
    });
  });

  /*
   * Switching to income and back must not silently carry a merchant the user
   * can no longer see into the saved row.
   */
  it('discards what was typed before switching to income', async () => {
    const onCreate = renderForm();

    await userEvent.type(screen.getByLabelText('Merchant'), 'Blue Bottle');
    await userEvent.click(screen.getByTestId('direction-income'));
    await userEvent.type(screen.getByLabelText('Amount'), '1500');
    await userEvent.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ merchant: undefined });
  });
});
