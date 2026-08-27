import { describe, expect, it } from 'vitest';

import { buttonContainerClass, buttonLabelClass } from './button.styles';

describe('buttonContainerClass', () => {
  it('defaults to the primary variant at medium size', () => {
    const result = buttonContainerClass();

    expect(result).toContain('bg-accent');
    expect(result).toContain('px-4');
    expect(result).not.toContain('opacity-50');
  });

  // Fully rounded rather than the card radius. This is the single biggest
  // change in feel, so it is asserted rather than left to a visual check.
  it('is a pill, whatever the size', () => {
    expect(buttonContainerClass('primary', 'sm')).toContain('rounded-pill');
    expect(buttonContainerClass('secondary', 'lg')).toContain('rounded-pill');
  });

  it('applies variant, size and disabled state together', () => {
    const result = buttonContainerClass('secondary', 'lg', true);

    expect(result).toContain('bg-surface-muted');
    expect(result).toContain('px-6');
    expect(result).toContain('opacity-50');
  });

  it('lets caller classes win over the defaults', () => {
    expect(buttonContainerClass('primary', 'md', false, 'bg-red-500')).toContain('bg-red-500');
    expect(buttonContainerClass('primary', 'md', false, 'bg-red-500')).not.toContain('bg-accent');
  });
});

describe('buttonLabelClass', () => {
  /**
   * Dark on the accent fill, not white. The mint is bright enough that a white
   * label falls below the contrast floor — which is the whole reason the
   * primary label does not use `content-inverse` like every other filled
   * button would.
   */
  it('puts a dark label on the accent fill', () => {
    expect(buttonLabelClass('primary')).toContain('text-content');
    expect(buttonLabelClass('primary')).not.toContain('text-content-inverse');
  });

  it('pairs the label colour with its variant', () => {
    expect(buttonLabelClass('secondary')).toContain('text-content');
    expect(buttonLabelClass('ghost')).toContain('text-link');
  });
});
