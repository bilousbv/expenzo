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

function renderForm(onCreate = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ExpenseForm
      currency="USD"
      timeZone="Europe/Madrid"
      today="2026-08-25"
      categories={categories}
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
