import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CategorySelect } from './category-select';
import type { CategoryOption } from './category-picker.styles';

const GROCERIES = '11111111-1111-4111-8111-111111111111';
const DINING = '22222222-2222-4222-8222-222222222222';

const options: CategoryOption[] = [
  { id: GROCERIES, name: 'Groceries', color: '#337dff', icon: null },
  { id: DINING, name: 'Dining out', color: '#f97316', icon: null },
];

describe('CategorySelect (web)', () => {
  it('lists every category plus an empty choice', () => {
    render(<CategorySelect options={options} onChange={vi.fn()} />);

    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('reports the chosen id', async () => {
    const onChange = vi.fn();
    render(<CategorySelect options={options} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Category'), DINING);

    expect(onChange).toHaveBeenCalledWith(DINING);
  });

  // An expense with no category is legitimate, so there has to be a way back to
  // none once a category has been picked.
  it('reports undefined rather than an empty string when cleared', async () => {
    const onChange = vi.fn();
    render(<CategorySelect options={options} value={DINING} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Category'), '');

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the current selection', () => {
    render(<CategorySelect options={options} value={GROCERIES} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Category')).toHaveValue(GROCERIES);
  });

  // Undefined on a controlled select would make React treat it as uncontrolled
  // and warn; the empty option is what "none" looks like to the DOM.
  it('selects the empty option when nothing is chosen', () => {
    render(<CategorySelect options={options} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Category')).toHaveValue('');
  });

  it('can be disabled', () => {
    render(<CategorySelect options={options} onChange={vi.fn()} disabled />);

    expect(screen.getByLabelText('Category')).toBeDisabled();
  });

  it('takes a custom label', () => {
    render(<CategorySelect options={options} onChange={vi.fn()} label="Filter by category" />);

    expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
  });
});
