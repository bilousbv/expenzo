import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders an email field and a submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send.*link/i })).toBeInTheDocument();
  });

  it('rejects a malformed address without calling the server', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid address', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ana@example.com'));
  });

  it('trims surrounding whitespace before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), '  ana@example.com  ');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ana@example.com'));
  });

  // Double-submitting a magic link sends two emails and invalidates the first,
  // which reads as "the link is broken" to the user.
  it('disables the button while the request is in flight', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());

    release();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('confirms once the link has been sent', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/check your (email|inbox)/i);
  });

  it('surfaces a failure without losing what was typed', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network unreachable'));
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/network unreachable/i);
    expect(screen.getByLabelText(/email/i)).toHaveValue('ana@example.com');
  });
});
