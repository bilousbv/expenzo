import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CreateExpenseInput } from '@expenzo/domain';
import type { CategoryOption } from '@expenzo/ui';

import { ExpenseForm } from '../src/features/expenses/expense-form';

type Create = (input: CreateExpenseInput) => Promise<void>;

// Real uuids, because createExpenseInput validates the shape of the category
// id. A readable placeholder would pass the press and fail validation.
const DINING = '22222222-2222-4222-8222-222222222222';

const categories: CategoryOption[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Groceries', color: '#337dff', icon: null },
  { id: DINING, name: 'Dining out', color: '#f97316', icon: null },
];

function renderForm(onCreate: jest.Mock<Create>, currencies?: string[]) {
  render(
    <ExpenseForm
      currency="USD"
      today="2026-08-25"
      categories={categories}
      currencies={currencies}
      onCreate={onCreate}
      autoFocusAmount={false}
    />,
  );
}

describe('ExpenseForm (native)', () => {
  it('submits an amount and the default date', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId('expense-submit'));

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

  it('sends the chosen category', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    // The category is a dropdown now: open it, then take an option.
    fireEvent.press(screen.getByTestId('category-select'));
    fireEvent.press(screen.getByTestId(`category-select-option-${DINING}`));
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: DINING })),
    );
  });

  // Every member of a household sees every expense, so there is nothing to
  // choose here any more and nothing to send.
  it('offers no privacy control and sends no visibility', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    expect(screen.queryByTestId('expense-personal')).toBeNull();

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).not.toHaveProperty('visibility');
  });

  it('refuses to submit without an amount', async () => {
    const onCreate = jest.fn<Create>();
    renderForm(onCreate);

    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(screen.getByTestId('expense-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Zero parses perfectly well and is not an expense. The column's check
  // constraint agrees.
  it('refuses a zero amount', async () => {
    const onCreate = jest.fn<Create>();
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '0');
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(screen.getByTestId('expense-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Three coffees from the same place on the same day should not mean retyping
  // the merchant three times.
  it('keeps the merchant after a successful add', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.changeText(screen.getByTestId('expense-merchant'), 'Blue Bottle');
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(screen.getByTestId('expense-merchant').props.value).toBe('Blue Bottle');
    expect(screen.getByTestId('amount-field').props.value).toBe('');
  });

  // A household with one currency has nothing to choose, and a picker holding a
  // single item is furniture.
  it('offers no currency control when only the household currency is available', () => {
    renderForm(jest.fn<Create>());

    expect(screen.queryByTestId('currency-select')).toBeNull();
  });

  // The expense keeps the currency it was entered in. The conversion into the
  // household's base currency happens in the database, once, at write time.
  it('sends the chosen currency rather than the household one', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate, ['EUR', 'USD']);

    fireEvent.press(screen.getByTestId('currency-select'));
    fireEvent.press(screen.getByTestId('currency-select-option-EUR'));
    fireEvent.changeText(screen.getByTestId('amount-field'), '20');
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', amountMinor: 2000 }),
      ),
    );
  });

  it('surfaces a failure without losing what was typed', async () => {
    const onCreate = jest
      .fn<Create>()
      .mockRejectedValue(new Error('permission denied for table expenses'));
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(screen.getByTestId('expense-error')).toBeTruthy());
    expect(screen.getByTestId('amount-field').props.value).toBe('12.50');
  });

  it('ignores a second press while the first is in flight', () => {
    let release = () => {};
    const onCreate = jest.fn<Create>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId('expense-submit'));
    fireEvent.press(screen.getByTestId('expense-submit'));

    expect(onCreate).toHaveBeenCalledTimes(1);
    release();
  });
});
