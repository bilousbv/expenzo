import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Avatar } from '@expenzo/ui';

// The native half of the same component. Importing the shared barrel here has
// to land on avatar.native.tsx, which renders an Image rather than an <img> —
// the platform split is only real if both halves are exercised.
describe('Avatar (native)', () => {
  it('shows the photo when there is one', () => {
    render(<Avatar name="Ana Petrenko" url="https://signed/ana" testID="who" />);

    expect(screen.getByTestId('who-image').props.source).toEqual({ uri: 'https://signed/ana' });
  });

  it('shows initials when there is none', () => {
    render(<Avatar name="Ana Petrenko" url={null} testID="who" />);

    expect(screen.queryByTestId('who-image')).toBeNull();
    expect(screen.getByText('AP')).toBeTruthy();
  });

  /*
   * A signed URL expires, and an avatar is decoration next to a name already
   * on the screen. Falling back keeps the row intact rather than leaving a
   * grey rectangle in it.
   */
  it('falls back to initials when the photo fails to load', () => {
    render(<Avatar name="Ana Petrenko" url="https://signed/expired" testID="who" />);

    fireEvent(screen.getByTestId('who-image'), 'error');

    expect(screen.getByText('AP')).toBeTruthy();
  });
});
