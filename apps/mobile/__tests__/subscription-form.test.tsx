import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ServiceRow } from '@expenzo/data';
import type { CreateSubscriptionInput } from '@expenzo/domain';
import type { CategoryOption } from '@expenzo/ui';

import { SubscriptionForm } from '../src/features/subscriptions/subscription-form';

type Create = (input: CreateSubscriptionInput) => Promise<void>;

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

function renderForm(onCreate: jest.Mock<Create>, today = '2026-08-27') {
  render(
    <SubscriptionForm
      currency="USD"
      services={SERVICES}
      categories={CATEGORIES}
      today={today}
      onCreate={onCreate}
    />,
  );
}

describe('SubscriptionForm (native)', () => {
  it('sends a name, an amount and a cadence', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Netflix', amountMinor: 1599, cadence: 'monthly' }),
      ),
    );
  });

  // Derived from the start date rather than asked for separately: asking twice
  // for the same fact is how the two come to disagree.
  it('derives the billing day from the start date', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.changeText(screen.getByTestId('subscription-started'), '2026-01-31');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ anchorDay: 31 })),
    );
  });

  it('changes the billing cycle', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Domain');
    fireEvent.changeText(screen.getByTestId('amount-field'), '12');
    fireEvent.press(screen.getByTestId('cadence-yearly'));
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ cadence: 'yearly' })),
    );
  });

  // Filling the field rather than replacing it: a household with two Netflix
  // accounts has to be able to say which is which.
  it('fills the name in when a service is picked from the catalogue', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.press(screen.getByTestId('subscription-service'));
    fireEvent.press(screen.getByTestId('subscription-service-spotify'));

    expect(screen.getByTestId('subscription-name').props.value).toBe('Spotify');

    fireEvent.changeText(screen.getByTestId('amount-field'), '9.99');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: SERVICES[1]!.id, name: 'Spotify' }),
      ),
    );
  });

  it('refuses a subscription with no name', async () => {
    const onCreate = jest.fn<Create>();
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('refuses one with no amount', async () => {
    const onCreate = jest.fn<Create>();
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('surfaces a failure without losing what was typed', async () => {
    const onCreate = jest
      .fn<Create>()
      .mockRejectedValue(new Error('permission denied for table subscriptions'));
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(screen.getByTestId('subscription-error')).toBeTruthy());
    expect(screen.getByTestId('subscription-name').props.value).toBe('Netflix');
  });
});

describe('a subscription that starts as a free trial (native)', () => {
  /*
   * The days are hidden until the trial is switched on: a "free days" box on
   * every subscription reads as a required field, and most have no trial.
   */
  it('asks for the free days only once a trial is declared', () => {
    renderForm(jest.fn<Create>());

    expect(screen.queryByTestId('subscription-trial-days')).toBeNull();

    fireEvent.press(screen.getByTestId('subscription-trial'));

    expect(screen.getByTestId('subscription-trial-days')).toBeTruthy();
  });

  it('sends the trial length', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate);

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.press(screen.getByTestId('subscription-trial'));
    fireEvent.changeText(screen.getByTestId('subscription-trial-days'), '30');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ trialDays: 30 });
  });

  /*
   * Billing runs from the end of the trial rather than the sign-up date, so a
   * 30-day trial started on 1 August bills on the 31st. The database computes
   * the same thing, and the two have to agree.
   */
  it('anchors the billing day to the end of the trial', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    renderForm(onCreate, '2026-08-01');

    fireEvent.changeText(screen.getByTestId('subscription-name'), 'Netflix');
    fireEvent.changeText(screen.getByTestId('amount-field'), '15.99');
    fireEvent.press(screen.getByTestId('subscription-trial'));
    fireEvent.changeText(screen.getByTestId('subscription-trial-days'), '30');
    fireEvent.press(screen.getByTestId('subscription-submit'));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ anchorDay: 31 });
  });

  it('says when the trial would run out', () => {
    renderForm(jest.fn<Create>(), '2026-08-27');

    fireEvent.press(screen.getByTestId('subscription-trial'));
    fireEvent.changeText(screen.getByTestId('subscription-trial-days'), '7');

    expect(screen.getByTestId('subscription-trial-ends')).toHaveTextContent(/2026-09-03/);
  });
});
