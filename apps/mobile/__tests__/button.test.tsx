import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@expenzo/ui';

// Importing the shared barrel here must land on button.native.tsx. Rendering a
// Pressable rather than a DOM button is what proves Metro's platform
// resolution is mirrored in the test environment.
describe('Button (native)', () => {
  it('renders its label', () => {
    render(<Button testID="save">Save</Button>);

    expect(screen.getByTestId('save')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <Button testID="save" onPress={onPress}>
        Save
      </Button>,
    );

    fireEvent.press(screen.getByTestId('save'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    render(
      <Button testID="save" disabled onPress={onPress}>
        Save
      </Button>,
    );

    fireEvent.press(screen.getByTestId('save'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
