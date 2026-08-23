import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

// Importing './button' under Vitest must land on the web variant. The native
// variant imports react-native, which would blow up in jsdom — so these tests
// passing is itself the proof that the platform split resolves correctly.
describe('Button (web)', () => {
  it('renders its label', () => {
    render(<Button testID="save">Save</Button>);

    expect(screen.getByTestId('save')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onPress when clicked', async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = vi.fn();
    render(
      <Button disabled onPress={onPress}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
