import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CurrencySelect } from './currency-select';

const currencies = ['EUR', 'GBP', 'USD'];

describe('CurrencySelect (web)', () => {
  it('offers every currency it was given', () => {
    render(<CurrencySelect currencies={currencies} value="USD" onChange={vi.fn()} />);

    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  // No empty choice, unlike the category select. Every expense is in some
  // currency, and "none" is not one of them.
  it('has no empty choice', () => {
    render(<CurrencySelect currencies={currencies} value="USD" onChange={vi.fn()} />);

    expect(screen.queryByRole('option', { name: '' })).not.toBeInTheDocument();
  });

  it('reports the chosen code', async () => {
    const onChange = vi.fn();
    render(<CurrencySelect currencies={currencies} value="USD" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');

    expect(onChange).toHaveBeenCalledWith('EUR');
  });

  it('shows the current selection', () => {
    render(<CurrencySelect currencies={currencies} value="GBP" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Currency')).toHaveValue('GBP');
  });

  // The rate table may not quote the household's own currency, and it needs no
  // rate to convert into itself. Dropping it would leave the form showing a
  // currency the user never chose.
  it('keeps the current value even when it is not in the list', () => {
    render(<CurrencySelect currencies={['EUR', 'USD']} value="CLP" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Currency')).toHaveValue('CLP');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('can be disabled', () => {
    render(<CurrencySelect currencies={currencies} value="USD" onChange={vi.fn()} disabled />);

    expect(screen.getByLabelText('Currency')).toBeDisabled();
  });
});
