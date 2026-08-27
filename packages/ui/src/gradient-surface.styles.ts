import type { ReactNode } from 'react';

import { cn } from './cn';

export interface GradientSurfaceProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

/**
 * The two stops of the balance panel, brightest first.
 *
 * Kept here rather than in the token file because a gradient cannot be a class
 * name on native — theme.js is limited to values both platforms can express as
 * one. These are `brand.500` and `brand.900`, so the panel stays in step with
 * the ramp if the ramp moves.
 */
export const GRADIENT_STOPS = ['#16a085', '#062b25'] as const;

/** The equivalent CSS, for the web half. */
export const GRADIENT_CSS = `linear-gradient(180deg, ${GRADIENT_STOPS[0]} 0%, ${GRADIENT_STOPS[1]} 100%)`;

export function gradientSurfaceClass(extra?: string): string {
  return cn('p-gutter', extra);
}
