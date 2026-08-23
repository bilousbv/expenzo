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
  primary: 'bg-brand-600',
  secondary: 'bg-surface-muted border border-brand-200',
  ghost: 'bg-transparent',
};

const label: Record<ButtonVariant, string> = {
  primary: 'text-content-inverse',
  secondary: 'text-brand-700',
  ghost: 'text-brand-600',
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
    'rounded-card flex-row items-center justify-center',
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
