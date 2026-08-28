import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FormScreen } from '../src/features/layout/form-screen';

describe('FormScreen (native)', () => {
  it('renders what it is given', () => {
    render(
      <FormScreen>
        <Text>Amount</Text>
      </FormScreen>,
    );

    expect(screen.getByText('Amount')).toBeTruthy();
  });

  /*
   * Without this, the first tap after the keyboard opens is swallowed by the
   * scroll view dismissing it — so the submit button needs pressing twice, and
   * the first press looks like it did nothing.
   */
  it('lets a tap through while the keyboard is open', () => {
    render(
      <FormScreen>
        <Text>Amount</Text>
      </FormScreen>,
    );

    expect(screen.getByTestId('form-scroll').props.keyboardShouldPersistTaps).toBe('handled');
  });

  /*
   * The keyboard covers the bottom of the screen, and a form taller than what
   * is left cannot be scrolled to. Insetting the container is what keeps the
   * field being typed into visible.
   */
  it('insets the form above the keyboard', () => {
    render(
      <FormScreen>
        <Text>Amount</Text>
      </FormScreen>,
    );

    expect(screen.getByTestId('form-keyboard-avoider')).toBeTruthy();
  });

  // A scroll view that is not allowed to grow leaves a short form pinned to
  // the top with no way to scroll a covered field into view.
  it('lets the content grow so it can always be scrolled', () => {
    render(
      <FormScreen>
        <Text>Amount</Text>
      </FormScreen>,
    );

    expect(screen.getByTestId('form-scroll').props.contentContainerClassName).toContain('grow');
  });
});
