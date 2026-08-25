import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInForm } from '../src/features/auth/sign-in-form';

type SubmitHandler = (email: string) => Promise<void>;

describe('SignInForm', () => {
  it('rejects a malformed address without calling the server', async () => {
    const onSubmit = jest.fn<SubmitHandler>();
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'nope');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-in-error')).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a trimmed address', async () => {
    const onSubmit = jest.fn<SubmitHandler>(() => Promise.resolve());
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), '  ana@example.com  ');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ana@example.com'));
  });

  it('confirms once the link has been sent', async () => {
    const onSubmit = jest.fn<SubmitHandler>(() => Promise.resolve());
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-in-sent')).toBeTruthy());
  });

  it('surfaces a failure without losing what was typed', async () => {
    const onSubmit = jest.fn<SubmitHandler>(() => Promise.reject(new Error('Network unreachable')));
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/network unreachable/i),
    );
    expect(screen.getByTestId('sign-in-email').props.value).toBe('ana@example.com');
  });

  // Sending twice invalidates the first link, which reads as "the link is
  // broken" to whoever taps the older email.
  it('does not submit twice while a request is in flight', async () => {
    let release: () => void = () => {};
    const onSubmit = jest.fn<SubmitHandler>(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<SignInForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    release();
  });
});
