import type { ReactNode } from 'react';

import { cn } from './cn';

export interface CardProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

export function cardClass(extra?: string): string {
  return cn('rounded-card bg-surface p-gutter border-brand-100 border', extra);
}
