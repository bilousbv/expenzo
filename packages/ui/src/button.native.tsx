import { Pressable, Text } from 'react-native';

import { buttonContainerClass, buttonLabelClass, type ButtonProps } from './button.styles';

/** React Native implementation, resolved by Metro through the `.native` suffix. */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onPress,
  className,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      className={buttonContainerClass(variant, size, disabled, className)}
    >
      <Text className={buttonLabelClass(variant, size)}>{children}</Text>
    </Pressable>
  );
}
