import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { IconTile } from '@expenzo/ui';

describe('IconTile (native)', () => {
  it('tints itself with the category colour', () => {
    render(<IconTile testID="tile" color="#337dff" />);

    // #RRGGBBAA rather than rgba(): React Native's style parser takes the hex
    // form, which lets both platforms use the identical value.
    expect(screen.getByTestId('tile').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#337dff22' }),
    );
  });

  it('falls back to a neutral tint when the category has no colour', () => {
    render(<IconTile testID="tile" color={null} />);

    expect(screen.getByTestId('tile').props.style).toEqual(
      expect.objectContaining({ backgroundColor: '#6b728022' }),
    );
  });
});
