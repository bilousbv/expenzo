import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfileForm } from './profile-form';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  firstName: 'Ana',
  lastName: 'Petrenko',
  displayName: 'ana',
  displayCurrency: null,
  avatarPath: null,
};

function renderForm(overrides: Partial<Parameters<typeof ProfileForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);

  render(
    <ProfileForm
      profile={profile}
      baseCurrency="USD"
      currencies={['EUR', 'UAH', 'USD']}
      onSave={onSave}
      {...overrides}
    />,
  );

  return onSave;
}

describe('ProfileForm', () => {
  it('starts from what is already stored', () => {
    renderForm();

    expect(screen.getByLabelText('First name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Last name')).toHaveValue('Petrenko');
  });

  it('saves the edited names', async () => {
    const onSave = renderForm();

    await userEvent.clear(screen.getByLabelText('First name'));
    await userEvent.type(screen.getByLabelText('First name'), 'Anna');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Anna', lastName: 'Petrenko' }),
      ),
    );
  });

  it('clears a removed last name rather than storing a blank', async () => {
    const onSave = renderForm();

    await userEvent.clear(screen.getByLabelText('Last name'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ lastName: null });
  });

  /*
   * The default is the household's own currency and is stored as null, so the
   * picker has to show it as a real, selected option rather than as an empty
   * slot the user has to guess at.
   */
  it('shows the household currency as the current choice', () => {
    renderForm();

    expect(screen.getByTestId('display-currency')).toHaveValue('USD');
  });

  // Two people reading one ledger in two currencies is the whole point: the
  // stored figures do not move, only what each of them is shown.
  it('saves a different currency to read totals in', async () => {
    const onSave = renderForm();

    await userEvent.selectOptions(screen.getByTestId('display-currency'), 'UAH');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayCurrency: 'UAH' })),
    );
  });

  /*
   * Choosing the household's currency again is a null, not that currency's
   * code. Storing the code would freeze the choice: if the household currency
   * ever differed, this member would silently keep the old one.
   */
  it('stores a return to the household currency as no choice at all', async () => {
    const onSave = renderForm({ profile: { ...profile, displayCurrency: 'UAH' } });

    await userEvent.selectOptions(screen.getByTestId('display-currency'), 'USD');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayCurrency: null })),
    );
  });

  /*
   * A magic-link account never had a name asked for, so a profile screen that
   * refuses to save without one would lock those people out of changing their
   * currency. The display falls back to the name signup derived.
   */
  it('allows a name to be removed entirely', async () => {
    const onSave = renderForm();

    await userEvent.clear(screen.getByLabelText('First name'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ firstName: null });
  });

  it('reports a failed save rather than looking as though it worked', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('currency CLP is not quoted'));
    renderForm({ onSave });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByTestId('profile-error')).toHaveTextContent('CLP');
  });
});
