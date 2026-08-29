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
 * name on native: theme.js is limited to values both platforms can express as
 * one, and every colour there is now a variable that swaps with the scheme.
 *
 * These two are deliberately fixed rather than scheme-aware. The panel is the
 * one surface that stays dark in both schemes, which is what makes it read as
 * the thing to look at first on either.
 */
export const GRADIENT_STOPS = ['#5b3fd6', '#1b1233'] as const;

/** The equivalent CSS, for the web half. */
export const GRADIENT_CSS = `linear-gradient(180deg, ${GRADIENT_STOPS[0]} 0%, ${GRADIENT_STOPS[1]} 100%)`;

export function gradientSurfaceClass(extra?: string): string {
  return cn('p-gutter', extra);
}
