import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import Home from './page';

describe('Home', () => {
  it('starts at zero', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: 'Expenzo' })).toBeInTheDocument();
    expect(screen.getByTestId('total-spent')).toHaveTextContent('$0.00');
  });

  it('accumulates each expense', async () => {
    render(<Home />);
    const add = screen.getByRole('button', { name: 'Add $12.50' });

    await userEvent.click(add);
    expect(screen.getByTestId('total-spent')).toHaveTextContent('$12.50');

    await userEvent.click(add);
    expect(screen.getByTestId('total-spent')).toHaveTextContent('$25.00');
  });

  it('resets the total', async () => {
    render(<Home />);

    await userEvent.click(screen.getByRole('button', { name: 'Add $12.50' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByTestId('total-spent')).toHaveTextContent('$0.00');
  });
});
