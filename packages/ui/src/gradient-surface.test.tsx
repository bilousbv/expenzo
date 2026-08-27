import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GradientSurface } from './gradient-surface';
import { GRADIENT_CSS, GRADIENT_STOPS } from './gradient-surface.styles';

describe('GradientSurface (web)', () => {
  it('renders what it wraps', () => {
    render(<GradientSurface testID="hero">£0.05</GradientSurface>);

    expect(screen.getByTestId('hero')).toHaveTextContent('£0.05');
  });

  it('paints the gradient rather than a flat colour', () => {
    render(<GradientSurface testID="hero">x</GradientSurface>);

    expect(screen.getByTestId('hero')).toHaveStyle({ backgroundImage: GRADIENT_CSS });
  });

  /**
   * The stops are shared with the native half, which cannot read CSS. If these
   * two ever stop agreeing the same screen is a different colour on each
   * platform, and nothing else would catch it.
   */
  it('builds its CSS from the shared stops, brightest first', () => {
    expect(GRADIENT_CSS).toContain(GRADIENT_STOPS[0]);
    expect(GRADIENT_CSS).toContain(GRADIENT_STOPS[1]);
    expect(GRADIENT_CSS.indexOf(GRADIENT_STOPS[0])).toBeLessThan(
      GRADIENT_CSS.indexOf(GRADIENT_STOPS[1]),
    );
  });

  it('takes extra classes from the caller', () => {
    render(
      <GradientSurface testID="hero" className="pb-20">
        x
      </GradientSurface>,
    );

    expect(screen.getByTestId('hero')).toHaveClass('pb-20');
  });
});
