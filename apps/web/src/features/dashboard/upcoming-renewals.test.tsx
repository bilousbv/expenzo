import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UpcomingRenewals } from './upcoming-renewals';

const TODAY = '2026-08-29';

const rows = [
  { id: 's1', name: 'Netflix', amountMinor: 1599, currency: 'USD', renewalOn: '2026-08-29' },
  { id: 's2', name: 'Spotify', amountMinor: 1099, currency: 'USD', renewalOn: '2026-08-30' },
  { id: 's3', name: 'Gym', amountMinor: 3000, currency: 'USD', renewalOn: '2026-09-02' },
];

describe('UpcomingRenewals', () => {
  it('lists what is due, soonest first', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    const names = screen.getAllByTestId('renewal-name').map((node) => node.textContent);
    expect(names).toEqual(['Netflix', 'Spotify', 'Gym']);
  });

  /*
   * A date on its own makes the reader do the arithmetic. "Today" is the whole
   * reason the card exists — it is the charge there is still time to stop.
   */
  it('says how far off each charge is rather than only its date', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    const when = screen.getAllByTestId('renewal-when').map((node) => node.textContent);
    expect(when).toEqual(['Today', 'Tomorrow', 'in 4 days']);
  });

  /*
   * In the currency it is billed in, not the reader's: a subscription is a
   * fixed charge from a merchant, and converting it would show a figure that
   * moves day to day and never matches the bank statement.
   */
  it('shows each amount in the currency it bills in', () => {
    render(
      <UpcomingRenewals
        rows={[{ id: 's4', name: 'Hosting', amountMinor: 900, currency: 'EUR', renewalOn: TODAY }]}
        today={TODAY}
      />,
    );

    expect(screen.getByTestId('renewal-amount')).toHaveTextContent('€9.00');
  });

  it('says so when nothing is due', () => {
    render(<UpcomingRenewals rows={[]} today={TODAY} />);

    expect(screen.getByTestId('no-renewals')).toBeInTheDocument();
  });

  // Nothing due and still loading are different states, and an empty card
  // shown while the answer is on its way reads as the answer.
  it('does not claim nothing is due while it is still loading', () => {
    render(<UpcomingRenewals rows={[]} today={TODAY} loading />);

    expect(screen.queryByTestId('no-renewals')).not.toBeInTheDocument();
  });

  it('links through to the subscriptions screen', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    expect(screen.getByTestId('renewals-all')).toHaveAttribute('href', '/subscriptions');
  });
});

describe('a trial ending', () => {
  const trialRow = {
    id: 's9',
    name: 'Fabric',
    amountMinor: 2000,
    currency: 'USD',
    renewalOn: '2026-09-01',
    trial: true,
  };

  /*
   * The trial end and the first charge are the same day by design, so this is
   * one row rather than two. What changes is what it is called: "trial ends"
   * is the day cancelling is still free, which is the only reason to look.
   */
  it('says the trial is ending rather than that it renews', () => {
    render(<UpcomingRenewals rows={[trialRow]} today={TODAY} />);

    expect(screen.getByTestId('renewal-when')).toHaveTextContent(/trial ends/i);
  });

  it('still says how far off it is', () => {
    render(<UpcomingRenewals rows={[trialRow]} today={TODAY} />);

    expect(screen.getByTestId('renewal-when')).toHaveTextContent('in 3 days');
  });

  it('leaves an ordinary renewal alone', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    expect(screen.getAllByTestId('renewal-when')[0]).not.toHaveTextContent(/trial/i);
  });
});
