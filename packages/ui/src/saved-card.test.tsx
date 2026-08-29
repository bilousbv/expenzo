import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SavedCard } from './saved-card';
import { isSaving, savedGlyph } from './saved-card.styles';

const labels = { title: 'Saved', explainer: 'Income minus spending' };

describe('isSaving', () => {
  it('is saving above zero and running down below it', () => {
    expect(isSaving(4_666_400)).toBe(true);
    expect(isSaving(-100)).toBe(false);
  });

  /*
   * Breaking even exactly has not lost anything, and colouring it red would be
   * a warning about nothing.
   */
  it('counts breaking even as saving', () => {
    expect(isSaving(0)).toBe(true);
  });
});

describe('savedGlyph', () => {
  // Direction is the information; the colour repeats it for anyone who cannot
  // rely on the colour.
  it('points up while saving and down while running down', () => {
    expect(savedGlyph(100)).toBe('↗');
    expect(savedGlyph(-100)).toBe('↘');
  });
});

describe('SavedCard (web)', () => {
  it('shows the figure with its direction', () => {
    render(<SavedCard savedMinor={4_666_400} savedLabel="46 664 ₴" {...labels} />);

    expect(screen.getByTestId('saved-amount')).toHaveTextContent('46 664 ₴');
    expect(screen.getByTestId('saved-amount')).toHaveTextContent('↗');
  });

  it('says what the figure is', () => {
    render(<SavedCard savedMinor={100} savedLabel="$1.00" {...labels} />);

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Income minus spending')).toBeInTheDocument();
  });

  // Spending more than came in is the case worth being unmistakable.
  it('turns the figure red when the household spent more than it earned', () => {
    render(<SavedCard savedMinor={-2_500} savedLabel="-$25.00" {...labels} />);

    const amount = screen.getByTestId('saved-amount');
    expect(amount.className).toContain('text-negative');
    expect(amount).toHaveTextContent('↘');
  });

  it('is green while the household is putting money aside', () => {
    render(<SavedCard savedMinor={2_500} savedLabel="$25.00" {...labels} />);

    expect(screen.getByTestId('saved-amount').className).toContain('text-positive');
  });
});
