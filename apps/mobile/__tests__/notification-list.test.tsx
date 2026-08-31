import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NotificationList } from '../src/features/notifications/notification-list';

const CATEGORY = '22222222-2222-4222-8222-222222222222';
const LIMIT = '44444444-4444-4444-8444-444444444444';
const OVERALL = '55555555-5555-4555-8555-555555555555';

function limit(overrides: Record<string, unknown> = {}) {
  return {
    limit_id: LIMIT,
    category_id: CATEGORY,
    amount_minor: 10000,
    spent_minor: 16000,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    createdAt: '2026-08-31T09:00:00+00:00',
    readAt: null,
    kind: 'limit_exceeded' as const,
    payload: { limits: [limit()] },
    ...overrides,
  };
}

const base = {
  categoryNames: { [CATEGORY]: 'Groceries' },
  format: (minor: number) => `$${(minor / 100).toFixed(2)}`,
  onRead: () => {},
  onReadAll: () => {},
};

describe('NotificationList (native)', () => {
  it('names the category and the figures that crossed the limit', () => {
    render(<NotificationList {...base} items={[item()]} />);

    expect(screen.getByTestId('notification-line')).toHaveTextContent(
      'Groceries: $160.00 of $100.00',
    );
  });

  // One purchase crossing a category limit and the household-wide one is a
  // single notification naming both: two lines, one item.
  it('lists every limit one notification names', () => {
    const both = item({
      payload: { limits: [limit(), limit({ limit_id: OVERALL, category_id: null })] },
    });

    render(<NotificationList {...base} items={[both]} />);

    expect(screen.getAllByTestId('notification-line')).toHaveLength(2);
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);
  });

  it('calls the household-wide limit by name rather than leaving it blank', () => {
    const overall = item({
      payload: { limits: [limit({ limit_id: OVERALL, category_id: null })] },
    });

    render(<NotificationList {...base} items={[overall]} />);

    expect(screen.getByTestId('notification-line')).toHaveTextContent(/household-wide/i);
  });

  it('counts what is unread', () => {
    render(
      <NotificationList
        {...base}
        items={[item(), item({ id: 'd2', readAt: '2026-08-31T10:00:00+00:00' })]}
      />,
    );

    expect(screen.getByTestId('notification-unread-count')).toHaveTextContent('1 unread');
  });

  it('says so when there is nothing', () => {
    render(<NotificationList {...base} items={[]} />);

    expect(screen.getByTestId('notifications-empty')).toBeTruthy();
  });

  /*
   * Payloads are written by a trigger and read months later. One written by an
   * older version is skipped rather than taking the inbox down with it.
   */
  it('skips a payload it cannot read instead of failing', () => {
    render(
      <NotificationList
        {...base}
        items={[item({ payload: { limits: [] } }), item({ id: 'd2' })]}
      />,
    );

    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);
  });

  it('marks one read when it is opened', () => {
    const onRead = jest.fn<(id: string) => void>();
    render(<NotificationList {...base} onRead={onRead} items={[item()]} />);

    fireEvent.press(screen.getByTestId('notification-item'));

    expect(onRead).toHaveBeenCalledWith('d1');
  });

  it('offers mark-all only while something is unread', () => {
    const { rerender } = render(<NotificationList {...base} items={[item()]} />);

    expect(screen.getByTestId('notifications-read-all')).toBeTruthy();

    rerender(
      <NotificationList {...base} items={[item({ readAt: '2026-08-31T10:00:00+00:00' })]} />,
    );

    expect(screen.queryByTestId('notifications-read-all')).toBeNull();
  });
});
