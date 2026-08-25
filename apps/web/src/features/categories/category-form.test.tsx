import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CategoryForm } from './category-form';

describe('CategoryForm', () => {
  it('submits the trimmed name', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Name'), '  Coffee  ');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Coffee' })),
    );
  });

  it('sends the chosen colour', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Coffee');
    await userEvent.click(screen.getByRole('radio', { name: 'Orange' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ color: '#f97316' })),
    );
  });

  it('does not submit a blank name', async () => {
    const onCreate = vi.fn();
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // A name of only emoji passes "not blank" but produces no slug, and the slug
  // is what the unique index is built on. Better to say so than to let the
  // database answer with a constraint name.
  it('rejects a name that cannot produce a slug', async () => {
    const onCreate = vi.fn();
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Name'), '🎉');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('clears the field after a successful add, ready for the next one', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CategoryForm onCreate={onCreate} />);

    const name = screen.getByLabelText('Name');
    await userEvent.type(name, 'Coffee');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => expect(name).toHaveValue(''));
  });

  it('keeps what was typed when the add fails, so nothing is lost', async () => {
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error('A category called Coffee already exists'));
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Coffee');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByLabelText('Name')).toHaveValue('Coffee');
  });

  // The household id is what the insert is scoped by, and it arrives from its
  // own query. Submitting before it lands reached the mutation and came back
  // "No household is loaded yet" — an error about the app's internals, in
  // response to a perfectly reasonable thing to do.
  it('does not submit while the household is still loading', async () => {
    const onCreate = vi.fn();
    render(<CategoryForm onCreate={onCreate} disabled />);

    await userEvent.type(screen.getByLabelText('Name'), 'Coffee');
    await userEvent.click(screen.getByRole('button', { name: /Add category|Loading/ }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  // A second submit while the first is in flight creates two categories that
  // differ only by whichever loses the unique index.
  it('ignores a second submit while the first is still running', async () => {
    let release = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<CategoryForm onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Coffee');
    const submit = screen.getByRole('button', { name: /Add category|Adding/ });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(onCreate).toHaveBeenCalledTimes(1);
    release();
  });
});
