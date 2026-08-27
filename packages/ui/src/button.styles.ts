import type { ReactNode } from 'react';

import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Fired on click (web) and on press (native). */
  onPress?: () => void;
  className?: string;
  testID?: string;
}

const container: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-surface-muted',
  ghost: 'bg-transparent',
};

// Dark on the accent fill: the mint is bright enough that a white label falls
// below the contrast floor, so this filled button breaks the usual rule that a
// coloured fill takes an inverse label.
const label: Record<ButtonVariant, string> = {
  primary: 'text-content',
  secondary: 'text-content',
  ghost: 'text-link',
};

const containerSize: Record<ButtonSize, string> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const labelSize: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

/**
 * Class strings are the shared half of the component: web and native render
 * different primitives but style them identically.
 */
export function buttonContainerClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  disabled = false,
  extra?: string,
): string {
  return cn(
    'rounded-pill flex-row items-center justify-center',
    container[variant],
    containerSize[size],
    disabled && 'opacity-50',
    extra,
  );
}

export function buttonLabelClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
): string {
  return cn('text-center font-semibold', label[variant], labelSize[size]);
}
