import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';
import { avatarInitials } from './avatar.styles';

describe('avatarInitials', () => {
  it('takes one letter from each of the two names', () => {
    expect(avatarInitials('Ana Petrenko')).toBe('AP');
  });

  it('takes one letter from a single name', () => {
    expect(avatarInitials('Ana')).toBe('A');
  });

  // A middle name should not push the surname out of the initials.
  it('uses the first and the last, not the first two', () => {
    expect(avatarInitials('Ana Maria Petrenko')).toBe('AP');
  });

  it('works in any script', () => {
    expect(avatarInitials('Ірина Коваль')).toBe('ІК');
  });

  /*
   * `charAt` would take half of an astral character and render the other half
   * as a replacement glyph.
   */
  it('keeps a character outside the basic plane whole', () => {
    expect(avatarInitials('😀 Somebody')).toBe('😀S');
  });

  it('falls back rather than rendering an empty circle', () => {
    expect(avatarInitials(null)).toBe('?');
    expect(avatarInitials('   ')).toBe('?');
  });
});

describe('Avatar (web)', () => {
  it('shows the photo when there is one', () => {
    render(<Avatar name="Ana Petrenko" url="https://signed/ana" />);

    const image = screen.getByRole('img', { name: 'Ana Petrenko' });
    expect(image).toHaveAttribute('src', 'https://signed/ana');
  });

  /*
   * Not an empty circle and not a broken image: most members will never upload
   * a photo, so the fallback is the ordinary case rather than an error state.
   */
  it('shows initials when there is none', () => {
    render(<Avatar name="Ana Petrenko" url={null} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('AP')).toBeInTheDocument();
  });

  /*
   * A signed URL expires, and an avatar is decoration next to a name that is
   * already on the screen. Falling back to initials keeps the row intact
   * rather than leaving a browser's broken-image glyph in it.
   */
  it('falls back to initials when the photo fails to load', () => {
    render(<Avatar name="Ana Petrenko" url="https://signed/expired" />);

    const image = screen.getByRole('img', { name: 'Ana Petrenko' });
    fireEvent.error(image);

    expect(screen.getByText('AP')).toBeInTheDocument();
  });

  // The name is already rendered next to it everywhere it appears, so a screen
  // reader announcing it twice is noise.
  it('is hidden from screen readers when it is only initials', () => {
    render(<Avatar name="Ana Petrenko" url={null} testID="who" />);

    expect(screen.getByTestId('who')).toHaveAttribute('aria-hidden', 'true');
  });
});
