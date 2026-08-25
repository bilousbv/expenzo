import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OAuthButtons } from './oauth-buttons';

describe('OAuthButtons', () => {
  // A provider with no credentials configured produces a button that can only
  // fail. Showing nothing is better than showing a trap.
  it('renders nothing when no provider is configured', () => {
    const { container } = render(<OAuthButtons providers={[]} onSignIn={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders only the providers it was given', () => {
    render(<OAuthButtons providers={['google']} onSignIn={vi.fn()} />);

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apple/i })).not.toBeInTheDocument();
  });

  it('reports which provider was chosen', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<OAuthButtons providers={['google', 'apple']} onSignIn={onSignIn} />);

    await userEvent.click(screen.getByRole('button', { name: /apple/i }));

    expect(onSignIn).toHaveBeenCalledWith('apple');
  });

  // The redirect leaves the page, so there is no re-render to disable the
  // buttons — a second click has to be refused in the handler.
  it('ignores a second click while the redirect is being prepared', async () => {
    let release = () => {};
    const onSignIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<OAuthButtons providers={['google']} onSignIn={onSignIn} />);

    const button = screen.getByRole('button', { name: /google/i });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onSignIn).toHaveBeenCalledTimes(1);
    release();
  });

  it('surfaces a failure rather than leaving the button spinning', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error('Provider not enabled'));
    render(<OAuthButtons providers={['google']} onSignIn={onSignIn} />);

    await userEvent.click(screen.getByRole('button', { name: /google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/provider not enabled/i);
  });
});
