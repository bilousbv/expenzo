import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CurrencySelect } from '@expenzo/ui';

type Change = (code: string) => void;

const currencies = ['EUR', 'GBP', 'USD'];

// The native half of the same component. Importing the shared barrel here must
// land on currency-select.native.tsx, which opens a Modal rather than rendering
// a <select> — the platform split is only real if both halves are exercised.
describe('CurrencySelect (native)', () => {
  it('shows the current currency on the trigger', () => {
    render(<CurrencySelect currencies={currencies} value="GBP" onChange={jest.fn<Change>()} />);

    expect(screen.getByText('GBP')).toBeTruthy();
  });

  it('does not render the options until opened', () => {
    render(<CurrencySelect currencies={currencies} value="USD" onChange={jest.fn<Change>()} />);

    expect(screen.queryByTestId('currency-select-option-EUR')).toBeNull();
  });

  it('reports the chosen code and closes', () => {
    const onChange = jest.fn<Change>();
    render(<CurrencySelect currencies={currencies} value="USD" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('currency-select'));
    fireEvent.press(screen.getByTestId('currency-select-option-EUR'));

    expect(onChange).toHaveBeenCalledWith('EUR');
    expect(screen.queryByTestId('currency-select-option-EUR')).toBeNull();
  });

  // The rate table may not quote the household's own currency, which needs no
  // rate to convert into itself.
  it('offers the current value even when it is not in the list', () => {
    render(<CurrencySelect currencies={['EUR', 'USD']} value="CLP" onChange={jest.fn<Change>()} />);

    fireEvent.press(screen.getByTestId('currency-select'));

    expect(screen.getByTestId('currency-select-option-CLP')).toBeTruthy();
  });

  // Tapping outside a sheet is how people dismiss one, and it must not count as
  // choosing anything.
  it('closes on the backdrop without changing the value', () => {
    const onChange = jest.fn<Change>();
    render(<CurrencySelect currencies={currencies} value="USD" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('currency-select'));
    fireEvent.press(screen.getByTestId('currency-select-backdrop'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('currency-select-option-EUR')).toBeNull();
  });

  it('does not open when disabled', () => {
    render(
      <CurrencySelect currencies={currencies} value="USD" onChange={jest.fn<Change>()} disabled />,
    );

    fireEvent.press(screen.getByTestId('currency-select'));

    expect(screen.queryByTestId('currency-select-option-EUR')).toBeNull();
  });
});
