import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { processColor, Text } from 'react-native';
import { GradientSurface, GRADIENT_STOPS } from '@expenzo/ui';

/**
 * The canary for the native half, in the same spirit as button.test.tsx: if
 * jest resolved `gradient-surface.tsx` instead of `gradient-surface.native.tsx`
 * this would try to render a `<div>` and fail.
 */
describe('GradientSurface (native)', () => {
  it('renders what it wraps', () => {
    render(
      <GradientSurface testID="hero">
        <Text>£0.05</Text>
      </GradientSurface>,
    );

    expect(screen.getByText('£0.05')).toBeTruthy();
  });

  it('passes the shared stops to the gradient, brightest first', () => {
    render(
      <GradientSurface testID="hero">
        <Text>x</Text>
      </GradientSurface>,
    );

    // expo-linear-gradient normalises colours through processColor, so the
    // rendered prop holds platform ints rather than the hex it was given.
    expect(screen.getByTestId('hero').props.colors).toEqual(
      GRADIENT_STOPS.map((stop) => processColor(stop)),
    );
  });

  // Top to bottom, matching the web half's `180deg`.
  it('runs the gradient down the panel', () => {
    render(
      <GradientSurface testID="hero">
        <Text>x</Text>
      </GradientSurface>,
    );

    const hero = screen.getByTestId('hero');

    // The library normalises the start and end props into point pairs.
    expect(hero.props.startPoint).toEqual([0, 0]);
    expect(hero.props.endPoint).toEqual([0, 1]);
  });
});
