import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn<(href: string) => void>();

jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));

import { UpcomingRenewals } from '../src/features/dashboard/upcoming-renewals';

const TODAY = '2026-08-29';

const rows = [
  { id: 's1', name: 'Netflix', amountMinor: 1599, currency: 'USD', renewalOn: '2026-08-29' },
  { id: 's2', name: 'Spotify', amountMinor: 1099, currency: 'USD', renewalOn: '2026-08-30' },
  { id: 's3', name: 'Gym', amountMinor: 3000, currency: 'USD', renewalOn: '2026-09-02' },
];

describe('UpcomingRenewals (native)', () => {
  it('lists what is due, soonest first', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    expect(screen.getAllByTestId('renewal-name').map((node) => node.props.children)).toEqual([
      'Netflix',
      'Spotify',
      'Gym',
    ]);
  });

  /*
   * A date on its own makes the reader do the arithmetic. "Today" is the whole
   * reason the card exists — it is the charge there is still time to stop.
   */
  it('says how far off each charge is rather than only its date', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    expect(screen.getAllByTestId('renewal-when').map((node) => node.props.children)).toEqual([
      'Today',
      'Tomorrow',
      'in 4 days',
    ]);
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

    expect(screen.getByTestId('renewal-amount').props.children).toBe('€9.00');
  });

  it('says so when nothing is due', () => {
    render(<UpcomingRenewals rows={[]} today={TODAY} />);

    expect(screen.getByTestId('no-renewals')).toBeTruthy();
  });

  // Nothing due and still loading are different states, and an empty card
  // shown while the answer is on its way reads as the answer.
  it('does not claim nothing is due while it is still loading', () => {
    render(<UpcomingRenewals rows={[]} today={TODAY} loading />);

    expect(screen.queryByTestId('no-renewals')).toBeNull();
  });

  it('opens the subscriptions tab', () => {
    render(<UpcomingRenewals rows={rows} today={TODAY} />);

    fireEvent.press(screen.getByTestId('renewals-all'));

    expect(mockPush).toHaveBeenCalledWith('/subscriptions');
  });
});
