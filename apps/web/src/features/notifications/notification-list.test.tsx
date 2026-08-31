import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NotificationList } from './notification-list';

const CATEGORY = '22222222-2222-4222-8222-222222222222';
const LIMIT = '44444444-4444-4444-8444-444444444444';
const OVERALL = '55555555-5555-4555-8555-555555555555';

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    createdAt: '2026-08-31T09:00:00+00:00',
    readAt: null,
    kind: 'limit_exceeded' as const,
    payload: {
      limits: [
        {
          limit_id: LIMIT,
          category_id: CATEGORY,
          amount_minor: 10000,
          spent_minor: 16000,
          period_start: '2026-08-01',
          period_end: '2026-08-31',
        },
      ],
    },
    ...overrides,
  };
}

const base = {
  categoryNames: { [CATEGORY]: 'Groceries' },
  format: (minor: number) => `$${(minor / 100).toFixed(2)}`,
  onRead: () => {},
  onReadAll: () => {},
};

describe('NotificationList', () => {
  it('names the category and the figures that crossed the limit', () => {
    render(<NotificationList {...base} items={[item()]} />);

    expect(screen.getByTestId('notification-line')).toHaveTextContent(
      'Groceries: $160.00 of $100.00',
    );
  });

  /*
   * One purchase can cross a category limit and the household-wide one at once,
   * and it arrives as a single notification naming both. Two lines, one item.
   */
  it('lists every limit one notification names', () => {
    const both = item({
      payload: {
        limits: [
          ...item().payload.limits,
          {
            limit_id: OVERALL,
            category_id: null,
            amount_minor: 50000,
            spent_minor: 51000,
            period_start: '2026-08-01',
            period_end: '2026-08-31',
          },
        ],
      },
    });

    render(<NotificationList {...base} items={[both]} />);

    expect(screen.getAllByTestId('notification-line')).toHaveLength(2);
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);
  });

  // Null is the household-wide limit, not a missing category. There is no
  // sentinel id, because any uuid meaning "everything" could one day be real.
  it('calls the household-wide limit by name rather than leaving it blank', () => {
    const overall = item({
      payload: {
        limits: [{ ...item().payload.limits[0], limit_id: OVERALL, category_id: null }],
      },
    });

    render(<NotificationList {...base} items={[overall]} />);

    expect(screen.getByTestId('notification-line')).toHaveTextContent(/household-wide/i);
  });

  it('falls back to a generic name for a category it cannot resolve', () => {
    render(<NotificationList {...base} categoryNames={{}} items={[item()]} />);

    expect(screen.getByTestId('notification-line')).not.toHaveTextContent(CATEGORY);
  });

  it('marks the unread ones and counts them', () => {
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

    expect(screen.getByTestId('notifications-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-unread-count')).not.toBeInTheDocument();
  });

  /*
   * Payloads are written by a trigger and read months later by this screen. One
   * written by an older version must be skipped rather than taking the whole
   * inbox down with it — an empty list is a bad day, an error page is a worse
   * one.
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

  it('marks one read when it is opened', async () => {
    const onRead = vi.fn();
    render(<NotificationList {...base} onRead={onRead} items={[item()]} />);

    await userEvent.click(screen.getByTestId('notification-item'));

    expect(onRead).toHaveBeenCalledWith('d1');
  });

  // Nothing to mark means no control: a button that cannot do anything is
  // worse than no button.
  it('offers mark-all only while something is unread', async () => {
    const onReadAll = vi.fn();
    const { rerender } = render(
      <NotificationList {...base} onReadAll={onReadAll} items={[item()]} />,
    );

    await userEvent.click(screen.getByTestId('notifications-read-all'));
    expect(onReadAll).toHaveBeenCalled();

    rerender(
      <NotificationList
        {...base}
        onReadAll={onReadAll}
        items={[item({ readAt: '2026-08-31T10:00:00+00:00' })]}
      />,
    );

    expect(screen.queryByTestId('notifications-read-all')).not.toBeInTheDocument();
  });
});
