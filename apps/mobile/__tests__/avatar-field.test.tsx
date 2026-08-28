import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockLaunchLibrary = jest.fn<() => Promise<unknown>>();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...(args as [])),
  MediaTypeOptions: { Images: 'Images' },
}));

import { AvatarField } from '../src/features/settings/avatar-field';

type Choose = (file: { body: Blob | ArrayBuffer; type: string; size: number }) => Promise<void>;
type Remove = () => Promise<void>;

/** One pixel of PNG, base64, which is what the picker hands back. */
const BASE64 = 'iVBORw0KGgoAAAANSUhEUg==';

function pickerReturns(asset: Record<string, unknown> | null) {
  mockLaunchLibrary.mockResolvedValue(
    asset === null ? { canceled: true, assets: null } : { canceled: false, assets: [asset] },
  );
}

function renderField(
  onChoose: Choose,
  onRemove: Remove = jest.fn<Remove>(),
  url: string | null = null,
) {
  render(<AvatarField name="Ana Petrenko" url={url} onChoose={onChoose} onRemove={onRemove} />);
}

describe('AvatarField (native)', () => {
  beforeEach(() => {
    mockLaunchLibrary.mockReset();
  });

  /*
   * An ArrayBuffer, not a Blob. A React Native Blob reaches Supabase storage
   * as zero bytes: the upload reports success and stores an empty object,
   * which looks exactly like it worked until somebody views the photo.
   */
  it('hands over decoded bytes rather than a blob', async () => {
    const onChoose = jest.fn<Choose>().mockResolvedValue(undefined);
    pickerReturns({ base64: BASE64, mimeType: 'image/png', fileSize: 18, uri: 'file:///me.png' });
    renderField(onChoose);

    fireEvent.press(screen.getByTestId('avatar-choose'));

    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    const handed = onChoose.mock.calls[0]?.[0];
    expect(handed?.body).toBeInstanceOf(ArrayBuffer);
    expect((handed?.body as ArrayBuffer).byteLength).toBeGreaterThan(0);
    expect(handed?.type).toBe('image/png');
  });

  // Cancelling is the most common outcome of opening a picker.
  it('does nothing when the picker is dismissed', async () => {
    const onChoose = jest.fn<Choose>().mockResolvedValue(undefined);
    pickerReturns(null);
    renderField(onChoose);

    fireEvent.press(screen.getByTestId('avatar-choose'));

    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalled());
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('refuses a picture larger than the bucket will take', async () => {
    const onChoose = jest.fn<Choose>().mockResolvedValue(undefined);
    pickerReturns({
      base64: BASE64,
      mimeType: 'image/png',
      fileSize: 3 * 1024 * 1024,
      uri: 'file:///big.png',
    });
    renderField(onChoose);

    fireEvent.press(screen.getByTestId('avatar-choose'));

    await waitFor(() => expect(screen.getByTestId('avatar-error')).toBeTruthy());
    expect(onChoose).not.toHaveBeenCalled();
  });

  /*
   * Android's picker regularly reports no mimeType at all. Refusing on that
   * would make the feature simply not work on a large share of phones, and the
   * bucket still has the final say over what it accepts.
   */
  it('falls back to the file extension when the picker reports no type', async () => {
    const onChoose = jest.fn<Choose>().mockResolvedValue(undefined);
    pickerReturns({ base64: BASE64, fileSize: 18, uri: 'file:///holiday.JPG' });
    renderField(onChoose);

    fireEvent.press(screen.getByTestId('avatar-choose'));

    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(onChoose.mock.calls[0]?.[0].type).toBe('image/jpeg');
  });

  it('offers removal only once there is a photo', () => {
    const { unmount } = render(
      <AvatarField
        name="Ana"
        url={null}
        onChoose={jest.fn<Choose>()}
        onRemove={jest.fn<Remove>()}
      />,
    );
    expect(screen.queryByTestId('avatar-remove')).toBeNull();
    unmount();

    render(
      <AvatarField
        name="Ana"
        url="https://signed/ana"
        onChoose={jest.fn<Choose>()}
        onRemove={jest.fn<Remove>()}
      />,
    );
    expect(screen.getByTestId('avatar-remove')).toBeTruthy();
  });

  it('reports a failed upload rather than looking as though it worked', async () => {
    const onChoose = jest.fn<Choose>().mockRejectedValue(new Error('Payload too large'));
    pickerReturns({ base64: BASE64, mimeType: 'image/png', fileSize: 18, uri: 'file:///me.png' });
    renderField(onChoose);

    fireEvent.press(screen.getByTestId('avatar-choose'));

    await waitFor(() => expect(screen.getByTestId('avatar-error')).toBeTruthy());
  });
});
