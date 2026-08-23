import { describe, expect, it } from 'vitest';

import { buttonContainerClass, buttonLabelClass } from './button.styles';

describe('buttonContainerClass', () => {
  it('defaults to the primary variant at medium size', () => {
    const result = buttonContainerClass();

    expect(result).toContain('bg-brand-600');
    expect(result).toContain('px-4');
    expect(result).not.toContain('opacity-50');
  });

  it('applies variant, size and disabled state together', () => {
    const result = buttonContainerClass('secondary', 'lg', true);

    expect(result).toContain('bg-surface-muted');
    expect(result).toContain('px-6');
    expect(result).toContain('opacity-50');
  });

  it('lets caller classes win over the defaults', () => {
    expect(buttonContainerClass('primary', 'md', false, 'bg-red-500')).toContain('bg-red-500');
    expect(buttonContainerClass('primary', 'md', false, 'bg-red-500')).not.toContain(
      'bg-brand-600',
    );
  });
});

describe('buttonLabelClass', () => {
  it('pairs the label colour with its variant', () => {
    expect(buttonLabelClass('primary')).toContain('text-content-inverse');
    expect(buttonLabelClass('ghost')).toContain('text-brand-600');
  });
});
