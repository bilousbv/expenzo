import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { SavedCard } from '@expenzo/ui';

const labels = { title: 'Saved', explainer: 'Income minus spending' };

// The native half of the same card, reached through the shared barrel.
describe('SavedCard (native)', () => {
  it('shows the figure with its direction', () => {
    render(<SavedCard savedMinor={4_666_400} savedLabel="46 664 ₴" {...labels} />);

    expect(screen.getByTestId('saved-amount')).toBeTruthy();
    expect(screen.getByText(/46 664/)).toBeTruthy();
  });

  it('says what the figure is', () => {
    render(<SavedCard savedMinor={100} savedLabel="$1.00" {...labels} />);

    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Income minus spending')).toBeTruthy();
  });
});
