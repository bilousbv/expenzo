import { LinearGradient } from 'expo-linear-gradient';

import {
  GRADIENT_STOPS,
  gradientSurfaceClass,
  type GradientSurfaceProps,
} from './gradient-surface.styles';

/**
 * The teal panel the balance sits on.
 *
 * `expo-linear-gradient` rather than a stack of translucent views: it is
 * first-party, version-matched by `expo install`, and the alternative bands
 * visibly on a dark ramp like this one.
 */
export function GradientSurface({ children, className, testID }: GradientSurfaceProps) {
  return (
    <LinearGradient
      testID={testID}
      // Top to bottom, matching the CSS `180deg` on the web half.
      colors={[...GRADIENT_STOPS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className={gradientSurfaceClass(className)}
    >
      {children}
    </LinearGradient>
  );
}
