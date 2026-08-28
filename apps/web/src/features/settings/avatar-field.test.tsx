import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarField } from './avatar-field';

function jpeg(bytes: number) {
  return new File([new Uint8Array(bytes)], 'me.jpg', { type: 'image/jpeg' });
}

function renderField(overrides: Partial<Parameters<typeof AvatarField>[0]> = {}) {
  const onChoose = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn().mockResolvedValue(undefined);

  render(
    <AvatarField
      name="Ana Petrenko"
      url={null}
      onChoose={onChoose}
      onRemove={onRemove}
      {...overrides}
    />,
  );

  return { onChoose, onRemove };
}

describe('AvatarField', () => {
  it('uploads the chosen photo', async () => {
    const { onChoose } = renderField();
    const file = jpeg(1000);

    await userEvent.upload(screen.getByTestId('avatar-input'), file);

    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith({ body: file, type: 'image/jpeg', size: 1000 }),
    );
  });

  /*
   * Checked here as well as by the repository and the bucket. This is the only
   * one of the three that can say what is wrong with the file before a round
   * trip spends the person's time on it.
   *
   * `applyAccept: false` on purpose. The accept attribute filters the file
   * picker, so a real person would struggle to select this — but drag-and-drop
   * ignores accept entirely, and so does a picker that chooses not to honour
   * it, which is the case this check exists for.
   */
  it('refuses a file that is not an image, without uploading it', async () => {
    const { onChoose } = renderField();

    await userEvent.upload(
      screen.getByTestId('avatar-input'),
      new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' }),
      { applyAccept: false },
    );

    expect(onChoose).not.toHaveBeenCalled();
    expect(await screen.findByTestId('avatar-error')).toHaveTextContent(/JPEG|PNG|WebP/i);
  });

  it('refuses one larger than the bucket will take', async () => {
    const { onChoose } = renderField();

    await userEvent.upload(screen.getByTestId('avatar-input'), jpeg(3 * 1024 * 1024));

    expect(onChoose).not.toHaveBeenCalled();
    expect(await screen.findByTestId('avatar-error')).toHaveTextContent(/2 MB/i);
  });

  // Removing something that is not there is a button that can only confuse.
  it('offers removal only once there is a photo', () => {
    const { unmount } = render(
      <AvatarField name="Ana" url={null} onChoose={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.queryByTestId('avatar-remove')).not.toBeInTheDocument();
    unmount();

    render(
      <AvatarField name="Ana" url="https://signed/ana" onChoose={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByTestId('avatar-remove')).toBeInTheDocument();
  });

  it('removes the photo when asked', async () => {
    const { onRemove } = renderField({ url: 'https://signed/ana' });

    await userEvent.click(screen.getByTestId('avatar-remove'));

    await waitFor(() => expect(onRemove).toHaveBeenCalled());
  });

  it('reports a failed upload rather than looking as though it worked', async () => {
    const onChoose = vi.fn().mockRejectedValue(new Error('Payload too large'));
    renderField({ onChoose });

    await userEvent.upload(screen.getByTestId('avatar-input'), jpeg(1000));

    expect(await screen.findByTestId('avatar-error')).toHaveTextContent('Payload too large');
  });

  /*
   * The same file twice in a row is a real case: a person picks the wrong one,
   * then picks the right one, then picks the first again. A file input that is
   * not cleared fires no change event the second time and the upload silently
   * does not happen.
   */
  it('accepts the same file twice', async () => {
    const { onChoose } = renderField();
    const file = jpeg(1000);
    const input = screen.getByTestId('avatar-input');

    await userEvent.upload(input, file);
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1));

    await userEvent.upload(input, file);
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(2));
  });
});
