import { buttonContainerClass, buttonLabelClass, type ButtonProps } from './button.styles';

/** Web implementation. Metro picks `button.native.tsx` instead on iOS/Android. */
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
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      className={buttonContainerClass(variant, size, disabled, className)}
    >
      <span className={buttonLabelClass(variant, size)}>{children}</span>
    </button>
  );
}
