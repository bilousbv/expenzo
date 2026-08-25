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

function renderForm(onCreate: jest.Mock<Create>) {
  render(
    <ExpenseForm
      currency="USD"
      today="2026-08-25"
      categories={categories}
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
          visibility: 'shared',
        }),
      ),
    );
  });

  it('sends the chosen category', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId(`category-chip-${DINING}`));
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: DINING })),
    );
  });

  it('can be marked personal', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');
    fireEvent.press(screen.getByTestId('expense-personal'));
    fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'personal' })),
    );
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
