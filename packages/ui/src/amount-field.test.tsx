import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AmountField } from './amount-field';

describe('AmountField (web)', () => {
  it('reports the amount in minor units', async () => {
    const onChange = vi.fn();
    render(<AmountField currency="USD" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Amount'), '12.50');

    expect(onChange).toHaveBeenLastCalledWith(1250);
  });

  it('accepts a decimal comma', async () => {
    const onChange = vi.fn();
    render(<AmountField currency="USD" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Amount'), '12,50');

    expect(onChange).toHaveBeenLastCalledWith(1250);
  });

  // The grouping convention resolves "1,234" to a thousand-odd rather than to
  // 1.234, and the only thing that makes guessing acceptable is showing the
  // reading back before it is saved.
  it('shows how it read what was typed', async () => {
    render(<AmountField currency="USD" onChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Amount'), '1,234');

    expect(screen.getByTestId('amount-preview')).toHaveTextContent('$1,234.00');
  });

  it('reports null while the value is not a number', async () => {
    const onChange = vi.fn();
    render(<AmountField currency="USD" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Amount'), 'abc');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('amount-preview')).not.toBeInTheDocument();
  });

  // Typing "12." is a state every decimal passes through. Complaining at that
  // moment means the field is red for most of the time it is being used.
  it('stays quiet while the number is still being typed', async () => {
    render(<AmountField currency="USD" onChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Amount'), '12.');

    expect(screen.queryByTestId('amount-error')).not.toBeInTheDocument();
  });

  it('complains once the field is left with something unreadable', async () => {
    render(<AmountField currency="USD" onChange={vi.fn()} />);

    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, 'abc');
    await userEvent.tab();

    expect(screen.getByTestId('amount-error')).toBeInTheDocument();
  });

  it('respects the currency exponent', async () => {
    const onChange = vi.fn();
    render(<AmountField currency="JPY" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Amount'), '1000');

    expect(onChange).toHaveBeenLastCalledWith(1000);
    expect(screen.getByTestId('amount-preview')).toHaveTextContent('¥1,000');
  });

  // The exponent is part of the reading, so switching currency after typing
  // changes what the same text means. Without re-reading, "1000" typed as
  // dollars stays 100000 minor units and is then filed as 100000 yen.
  it('re-reads what was typed when the currency changes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<AmountField currency="USD" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Amount'), '1000');
    expect(onChange).toHaveBeenLastCalledWith(100000);

    rerender(<AmountField currency="JPY" onChange={onChange} />);

    expect(onChange).toHaveBeenLastCalledWith(1000);
    expect(screen.getByTestId('amount-preview')).toHaveTextContent('¥1,000');
  });

  it('shows an initial amount in editable form', () => {
    render(<AmountField currency="USD" valueMinor={1250} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Amount')).toHaveValue('12.50');
  });

  // A numeric keypad on a phone, and no spinner arrows on desktop that would
  // silently step an amount by one whole unit.
  it('asks for a decimal keypad rather than a number spinner', () => {
    render(<AmountField currency="USD" onChange={vi.fn()} />);

    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).not.toHaveAttribute('type', 'number');
  });
});
