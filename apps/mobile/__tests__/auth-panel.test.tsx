import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

/*
 * expo-linking reads the scheme out of the expo-constants manifest, which only
 * exists in a built app; under jest it throws rather than returning a URL.
 */
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `expenzo://${path.replace(/^\//, '')}`,
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('../src/env', () => ({ env: () => ({ oauthProviders: [] }) }));

jest.mock('../src/lib/supabase', () => ({ supabase: { auth: {} } }));

import { AuthPanel } from '../src/features/auth/auth-panel';

describe('AuthPanel', () => {
  it('offers the sign-in link when signing in', () => {
    render(<AuthPanel mode="signIn" />);

    expect(screen.getByTestId('show-magic-link')).toBeTruthy();
  });

  /*
   * A link signs an existing account in; it does not open one. Offered here it
   * would read as a way to register, and a link asked for from a mistyped
   * address would leave someone in an empty household.
   */
  it('does not offer it as a way to register', () => {
    render(<AuthPanel mode="signUp" />);

    expect(screen.queryByTestId('show-magic-link')).toBeNull();
  });
});
