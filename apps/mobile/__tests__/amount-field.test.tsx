import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AmountField } from '@expenzo/ui';

type Change = (amountMinor: number | null) => void;

// The native half of the same component. Importing the shared barrel here must
// land on amount-field.native.tsx, which renders a TextInput rather than an
// input — the platform split is only real if both halves are exercised.
describe('AmountField (native)', () => {
  it('reports the amount in minor units', () => {
    const onChange = jest.fn<Change>();
    render(<AmountField currency="USD" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12.50');

    expect(onChange).toHaveBeenLastCalledWith(1250);
  });

  it('accepts a decimal comma', () => {
    const onChange = jest.fn<Change>();
    render(<AmountField currency="USD" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('amount-field'), '12,50');

    expect(onChange).toHaveBeenLastCalledWith(1250);
  });

  it('shows how it read what was typed', () => {
    render(<AmountField currency="USD" onChange={jest.fn<Change>()} />);

    fireEvent.changeText(screen.getByTestId('amount-field'), '1,234');

    expect(screen.getByTestId('amount-preview')).toHaveTextContent('$1,234.00');
  });

  it('reports null while the value is not a number', () => {
    const onChange = jest.fn<Change>();
    render(<AmountField currency="USD" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('amount-field'), 'abc');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('amount-preview')).toBeNull();
  });

  // Every decimal passes through "12." on the way to "12.5". Complaining then
  // means the field is red for most of the time it is being used.
  it('stays quiet while the number is still being typed', () => {
    render(<AmountField currency="USD" onChange={jest.fn<Change>()} />);

    const input = screen.getByTestId('amount-field');
    fireEvent.changeText(input, '12.');
    fireEvent(input, 'blur');

    expect(screen.queryByTestId('amount-error')).toBeNull();
  });

  it('complains once the field is left with something unreadable', () => {
    render(<AmountField currency="USD" onChange={jest.fn<Change>()} />);

    const input = screen.getByTestId('amount-field');
    fireEvent.changeText(input, 'abc');
    fireEvent(input, 'blur');

    expect(screen.getByTestId('amount-error')).toBeTruthy();
  });

  it('respects the currency exponent', () => {
    const onChange = jest.fn<Change>();
    render(<AmountField currency="JPY" onChange={onChange} />);

    fireEvent.changeText(screen.getByTestId('amount-field'), '1000');

    expect(onChange).toHaveBeenLastCalledWith(1000);
  });

  // decimal-pad carries the separator key; the plain numeric pad does not, and
  // an amount field without a decimal point is not much use.
  it('asks for the decimal keypad', () => {
    render(<AmountField currency="USD" onChange={jest.fn<Change>()} />);

    expect(screen.getByTestId('amount-field').props.keyboardType).toBe('decimal-pad');
  });

  // M6 opens this screen straight from a wallet payment, where the amount is
  // the only thing the user still has to type.
  it('can take focus on mount', () => {
    render(<AmountField currency="USD" autoFocus onChange={jest.fn<Change>()} />);

    expect(screen.getByTestId('amount-field').props.autoFocus).toBe(true);
  });
});
