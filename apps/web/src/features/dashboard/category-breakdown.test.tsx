import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CategoryBreakdown } from './category-breakdown';

const display = {
  currency: 'USD',
  baseCurrency: 'USD',
  approximate: false,
  convert: (minor: number) => minor,
};

const rows = [
  { categoryId: 'c1', name: 'Groceries', color: '#337dff', spentMinor: 5000, limitMinor: null },
  { categoryId: null, name: 'Uncategorised', color: null, spentMinor: 2500, limitMinor: null },
];

describe('CategoryBreakdown', () => {
  /*
   * The dashboard no longer lists expenses, so the rollup is the only way into
   * them: a category has to be the thing you click to see what is inside it.
   */
  it('links each category to its own page', () => {
    render(
      <CategoryBreakdown
        rows={rows}
        display={display}
        hrefFor={(id) => `/categories/${id ?? 'uncategorised'}`}
      />,
    );

    expect(screen.getByRole('link', { name: /Groceries/ })).toHaveAttribute(
      'href',
      '/categories/c1',
    );
  });

  /*
   * Expenses with no category still sum to something, and dropping them would
   * make the rollup disagree with the period total — so that row needs a
   * destination too, and it cannot be an id.
   */
  it('gives the uncategorised row a destination of its own', () => {
    render(
      <CategoryBreakdown
        rows={rows}
        display={display}
        hrefFor={(id) => `/categories/${id ?? 'uncategorised'}`}
      />,
    );

    expect(screen.getByRole('link', { name: /Uncategorised/ })).toHaveAttribute(
      'href',
      '/categories/uncategorised',
    );
  });

  // The household-wide limit is rendered through this same component and is
  // not a category, so it has nowhere to go.
  it('renders plain rows when there is nowhere to link to', () => {
    render(<CategoryBreakdown rows={rows} display={display} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
