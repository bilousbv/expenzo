import {
  GRADIENT_CSS,
  gradientSurfaceClass,
  type GradientSurfaceProps,
} from './gradient-surface.styles';

/**
 * The teal panel the balance sits on.
 *
 * A background image rather than a class: Tailwind cannot express a two-stop
 * gradient without arbitrary values, and the native half has to read the same
 * stops from the same module or the two platforms drift apart.
 */
export function GradientSurface({ children, className, testID }: GradientSurfaceProps) {
  return (
    <div
      data-testid={testID}
      className={gradientSurfaceClass(className)}
      style={{ backgroundImage: GRADIENT_CSS }}
    >
      {children}
    </div>
  );
}
