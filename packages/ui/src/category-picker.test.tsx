import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CategoryPicker } from './category-picker';
import type { CategoryOption } from './category-picker.styles';

const options: CategoryOption[] = [
  { id: 'a', name: 'Groceries', color: '#337dff', icon: 'shopping-cart' },
  { id: 'b', name: 'Dining out', color: '#f97316', icon: 'utensils' },
  { id: 'c', name: 'Coffee', color: null, icon: null },
];

describe('CategoryPicker (web)', () => {
  it('renders one chip per category', () => {
    render(<CategoryPicker options={options} onChange={vi.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  // A radiogroup rather than a list of buttons: it is a single-choice control,
  // and screen readers announce "2 of 3" only when the roles say so.
  it('exposes itself as a radiogroup', () => {
    render(<CategoryPicker options={options} onChange={vi.fn()} label="Category" />);

    expect(screen.getByRole('radiogroup', { name: 'Category' })).toBeInTheDocument();
  });

  it('marks the selected category checked', () => {
    render(<CategoryPicker options={options} value="b" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Dining out' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Groceries' })).not.toBeChecked();
  });

  it('reports the chosen id', async () => {
    const onChange = vi.fn();
    render(<CategoryPicker options={options} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Coffee' }));

    expect(onChange).toHaveBeenCalledWith('c');
  });

  // Tapping the current selection again clears it. An expense with no category
  // is legitimate, and without this there is no way back to "none" once a chip
  // has been touched.
  it('clears the selection when the selected chip is pressed again', async () => {
    const onChange = vi.fn();
    render(<CategoryPicker options={options} value="c" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Coffee' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not fire when disabled', async () => {
    const onChange = vi.fn();
    render(<CategoryPicker options={options} onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole('radio', { name: 'Groceries' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so rather than rendering an empty strip when there is nothing to pick', () => {
    render(<CategoryPicker options={[]} onChange={vi.fn()} />);

    expect(screen.getByTestId('category-picker-empty')).toBeInTheDocument();
  });
});
