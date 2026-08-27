import type { ReactNode } from 'react';

import { cn } from './cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

export function cardClass(extra?: string): string {
  // No border. On the grey app background a white card separates itself well
  // enough, and a border at this radius reads as a box rather than a surface.
  return cn('rounded-card bg-surface p-gutter', extra);
}
