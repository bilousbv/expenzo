import { cn } from './cn';

/**
 * One definition of what an input looks like.
 *
 * Filled rather than outlined. A one-pixel border at this radius reads as a box
 * drawn around the value; a filled well reads as somewhere to put one, which is
 * the treatment the reference uses for its search field and the one that keeps
 * a long form from looking like a grid of rectangles.
 *
 * Shared so the forms in both apps and the pickers in this package cannot drift
 * apart — before this existed each form carried its own copy of the string, and
 * the pickers had already diverged into laying their labels out inline.
 */
export function fieldInputClass(invalid = false, extra?: string): string {
  return cn(
    'rounded-card bg-surface-muted text-content w-full px-4 py-3',
    invalid && 'bg-red-50',
    extra,
  );
}

export const fieldLabelClass = 'text-content-muted text-sm font-medium';

/** Stacks a label above its control, which is what makes them full width. */
export const fieldGroupClass = 'flex flex-col gap-1';
