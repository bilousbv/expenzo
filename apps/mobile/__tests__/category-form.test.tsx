import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CreateCategoryInput } from '@expenzo/domain';

import { CategoryForm } from '../src/features/categories/category-form';

type Create = (input: CreateCategoryInput) => Promise<void>;

describe('CategoryForm (native)', () => {
  it('submits the trimmed name', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.changeText(screen.getByTestId('category-name'), '  Coffee  ');
    fireEvent.press(screen.getByTestId('category-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Coffee' })),
    );
  });

  it('sends the chosen colour', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.changeText(screen.getByTestId('category-name'), 'Coffee');
    fireEvent.press(screen.getByTestId('category-color-#f97316'));
    fireEvent.press(screen.getByTestId('category-submit'));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ color: '#f97316' })),
    );
  });

  it('does not submit a blank name', async () => {
    const onCreate = jest.fn<Create>();
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.press(screen.getByTestId('category-submit'));

    await waitFor(() => expect(screen.getByTestId('category-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  // A name of only emoji is not blank but produces no slug, and the slug is
  // what the unique index is built on.
  it('rejects a name that cannot produce a slug', async () => {
    const onCreate = jest.fn<Create>();
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.changeText(screen.getByTestId('category-name'), '🎉');
    fireEvent.press(screen.getByTestId('category-submit'));

    await waitFor(() => expect(screen.getByTestId('category-error')).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the add fails', async () => {
    const onCreate = jest
      .fn<Create>()
      .mockRejectedValue(new Error('A category called Coffee already exists'));
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.changeText(screen.getByTestId('category-name'), 'Coffee');
    fireEvent.press(screen.getByTestId('category-submit'));

    await waitFor(() => expect(screen.getByTestId('category-error')).toBeTruthy());
    expect(screen.getByTestId('category-name').props.value).toBe('Coffee');
  });

  // The household id is what the insert is scoped by, and it arrives from its
  // own query. Submitting before it lands reached the mutation and came back
  // "No household is loaded yet" — an error about the app's internals, in
  // response to a perfectly reasonable thing to do.
  it('does not submit while the household is still loading', () => {
    const onCreate = jest.fn<Create>();
    render(<CategoryForm onCreate={onCreate} disabled />);

    fireEvent.changeText(screen.getByTestId('category-name'), 'Coffee');
    fireEvent.press(screen.getByTestId('category-submit'));

    expect(onCreate).not.toHaveBeenCalled();
  });

  // A fast double tap lands two presses before the re-render, and the second
  // one loses the unique index for reasons the user cannot see.
  it('ignores a second press while the first is still running', async () => {
    let release = () => {};
    const onCreate = jest.fn<Create>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<CategoryForm onCreate={onCreate} />);

    fireEvent.changeText(screen.getByTestId('category-name'), 'Coffee');
    fireEvent.press(screen.getByTestId('category-submit'));
    fireEvent.press(screen.getByTestId('category-submit'));

    expect(onCreate).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.getByTestId('category-name').props.value).toBe(''));
  });
});
