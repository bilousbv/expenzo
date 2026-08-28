import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileForm } from '../src/features/settings/profile-form';

type Save = (input: {
  firstName?: string | null;
  lastName?: string | null;
  displayCurrency?: string | null;
}) => Promise<void>;

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  firstName: 'Ana',
  lastName: 'Petrenko',
  displayName: 'ana',
  displayCurrency: null,
  avatarPath: null,
};

function renderForm(onSave: Save, displayCurrency: string | null = null) {
  render(
    <ProfileForm
      profile={{ ...profile, displayCurrency }}
      baseCurrency="USD"
      currencies={['EUR', 'UAH', 'USD']}
      onSave={onSave}
    />,
  );
}

describe('ProfileForm (native)', () => {
  it('starts from what is already stored', () => {
    renderForm(jest.fn<Save>());

    expect(screen.getByTestId('profile-first-name').props.value).toBe('Ana');
    expect(screen.getByTestId('profile-last-name').props.value).toBe('Petrenko');
  });

  it('saves the edited names', async () => {
    const onSave = jest.fn<Save>().mockResolvedValue(undefined);
    renderForm(onSave);

    fireEvent.changeText(screen.getByTestId('profile-first-name'), 'Anna');
    fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Anna', lastName: 'Petrenko' }),
      ),
    );
  });

  /*
   * A magic-link account never had a name asked for, so refusing to save
   * without one would lock those people out of changing their currency.
   */
  it('allows a name to be removed entirely', async () => {
    const onSave = jest.fn<Save>().mockResolvedValue(undefined);
    renderForm(onSave);

    fireEvent.changeText(screen.getByTestId('profile-first-name'), '');
    fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ firstName: null })),
    );
  });

  // Two people reading one ledger in two currencies is the whole point.
  it('saves a different currency to read totals in', async () => {
    const onSave = jest.fn<Save>().mockResolvedValue(undefined);
    renderForm(onSave);

    fireEvent.press(screen.getByTestId('display-currency'));
    fireEvent.press(screen.getByTestId('display-currency-option-UAH'));
    fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayCurrency: 'UAH' })),
    );
  });

  /*
   * Picking the household's own currency is stored as null. Storing the code
   * would freeze the choice, so a member would silently keep the old currency
   * if the household's ever differed.
   */
  it('stores a return to the household currency as no choice at all', async () => {
    const onSave = jest.fn<Save>().mockResolvedValue(undefined);
    renderForm(onSave, 'UAH');

    fireEvent.press(screen.getByTestId('display-currency'));
    fireEvent.press(screen.getByTestId('display-currency-option-USD'));
    fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayCurrency: null })),
    );
  });

  it('reports a failed save rather than looking as though it worked', async () => {
    const onSave = jest.fn<Save>().mockRejectedValue(new Error('currency CLP is not quoted'));
    renderForm(onSave);

    fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeTruthy());
  });
});
