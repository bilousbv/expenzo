import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HomeScreen } from '../src/features/home/home-screen';

// Route files under src/app stay thin so they need no tests of their own; the
// screen they render is where the behaviour lives.
describe('HomeScreen', () => {
  it('starts at zero', () => {
    render(<HomeScreen />);

    expect(screen.getByText('Expenzo')).toBeTruthy();
    expect(screen.getByTestId('total-spent')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
  });

  it('accumulates each expense', () => {
    render(<HomeScreen />);
    const add = screen.getByTestId('add-expense');

    fireEvent.press(add);
    expect(screen.getByText('$12.50')).toBeTruthy();

    fireEvent.press(add);
    expect(screen.getByText('$25.00')).toBeTruthy();
  });

  it('resets the total', () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('add-expense'));
    fireEvent.press(screen.getByTestId('reset-total'));

    expect(screen.getByText('$0.00')).toBeTruthy();
  });
});
