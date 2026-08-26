import type { ServiceRow } from '@expenzo/data';
import type { CreateSubscriptionInput } from '@expenzo/domain';
import type { CategoryOption } from '@expenzo/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubscriptionForm } from './subscription-form';

const SERVICES: ServiceRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'netflix',
    name: 'Netflix',
    domain: 'netflix.com',
    category_hint: 'Entertainment',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'spotify',
    name: 'Spotify',
    domain: 'spotify.com',
    category_hint: 'Entertainment',
  },
];

const CATEGORIES: CategoryOption[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Entertainment',
    color: '#337dff',
    icon: null,
  },
];

function renderForm(onCreate: (input: CreateSubscriptionInput) => Promise<void>) {
  render(
    <SubscriptionForm
      currency="USD"
      services={SERVICES}
      categories={CATEGORIES}
      today="2026-08-27"
      onCreate={onCreate}
    />,
  );
}

describe('SubscriptionForm', () => {
  it('sends a name, an amount and a cadence', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Netflix');
    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Netflix', amountMinor: 1599, cadence: 'monthly' }),
      ),
    );
  });

  /**
   * The anchor is derived rather than asked for. Nobody thinks of a
   * subscription as "anchored on the 27th" — and asking for the same fact
   * twice is how the two come to disagree.
   */
  it('derives the billing day from the start date', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Netflix');
    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.clear(screen.getByTestId('subscription-started'));
    await userEvent.type(screen.getByTestId('subscription-started'), '2026-01-31');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ anchorDay: 31, startedOn: '2026-01-31' }),
      ),
    );
  });

  // Filling the field rather than replacing it: a household with two Netflix
  // accounts has to be able to say which is which.
  it('fills the name in when a service is picked, and leaves it editable', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.selectOptions(screen.getByTestId('subscription-service'), 'Spotify');

    expect(screen.getByTestId('subscription-name')).toHaveValue('Spotify');

    await userEvent.type(screen.getByTestId('subscription-name'), ' Family');
    await userEvent.type(screen.getByLabelText('Amount'), '9.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spotify Family' })),
    );
  });

  it('sends the catalogue id when one was picked', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.selectOptions(screen.getByTestId('subscription-service'), 'Netflix');
    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: SERVICES[0]!.id }),
      ),
    );
  });

  // Most subscriptions are in no catalogue, so this has to work.
  it('sends no service id when none was picked', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Local gym');
    await userEvent.type(screen.getByLabelText('Amount'), '30');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    // Present but undefined, which is what zod's `.optional()` produces — the
    // repository turns it into an explicit null so the column is written
    // rather than left out.
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]?.serviceId).toBeUndefined();
  });

  it('offers every billing cycle', async () => {
    renderForm(vi.fn());

    const options = [...screen.getByTestId('subscription-cadence').querySelectorAll('option')];

    expect(options.map((option) => option.value)).toEqual([
      'weekly',
      'monthly',
      'quarterly',
      'semiannual',
      'yearly',
    ]);
  });

  it('refuses a subscription with no name', async () => {
    const onCreate = vi.fn();
    renderForm(onCreate);

    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-error')).toBeInTheDocument());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('refuses one with no amount', async () => {
    const onCreate = vi.fn();
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Netflix');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-error')).toBeInTheDocument());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('surfaces a failure without losing what was typed', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error('permission denied for table subscriptions'));
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Netflix');
    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('subscription-error')).toHaveTextContent(/denied/),
    );
    expect(screen.getByTestId('subscription-name')).toHaveValue('Netflix');
  });

  it('clears the name after a successful add', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderForm(onCreate);

    await userEvent.type(screen.getByTestId('subscription-name'), 'Netflix');
    await userEvent.type(screen.getByLabelText('Amount'), '15.99');
    await userEvent.click(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-name')).toHaveValue(''));
  });
});
