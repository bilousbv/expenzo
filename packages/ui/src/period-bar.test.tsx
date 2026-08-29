import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PeriodBar } from './period-bar';

const labels = {
  openLabel: 'Change period',
  previousLabel: 'Previous month',
  nextLabel: 'Next month',
};

describe('PeriodBar (web)', () => {
  it('shows the name over the exact dates', () => {
    render(
      <PeriodBar label="This month" dates="01.03.2026 — 31.03.2026" onOpen={vi.fn()} {...labels} />,
    );

    expect(screen.getByTestId('period-label')).toHaveTextContent('This month');
    expect(screen.getByTestId('period-dates')).toHaveTextContent('01.03.2026 — 31.03.2026');
  });

  it('steps back and forward a month', async () => {
    const onStep = vi.fn();
    render(<PeriodBar label="Mar 26" dates="…" onStep={onStep} onOpen={vi.fn()} {...labels} />);

    await userEvent.click(screen.getByTestId('period-previous'));
    await userEvent.click(screen.getByTestId('period-next'));

    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  /*
   * The arrows step whole months, so they only make sense while the period is
   * one. Stepping an arbitrary range forward by a month is not a thing anybody
   * asked for, and offering it would raise the question of what it means.
   */
  it('hides the arrows when the period is not steppable', () => {
    render(<PeriodBar label="Custom" dates="…" onOpen={vi.fn()} {...labels} />);

    expect(screen.queryByTestId('period-previous')).not.toBeInTheDocument();
    expect(screen.queryByTestId('period-next')).not.toBeInTheDocument();
  });

  it('opens the picker from the centre', async () => {
    const onOpen = vi.fn();
    render(<PeriodBar label="This month" dates="…" onOpen={onOpen} {...labels} />);

    await userEvent.click(screen.getByTestId('period-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // The arrows are glyphs, so without a name they announce as "button" and
  // nothing else.
  it('names both arrows for a screen reader', () => {
    render(<PeriodBar label="Mar 26" dates="…" onStep={vi.fn()} onOpen={vi.fn()} {...labels} />);

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
  });
});
