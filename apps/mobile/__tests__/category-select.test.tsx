import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CategorySelect, type CategoryOption } from '@expenzo/ui';

type Change = (id: string | undefined) => void;

const GROCERIES = '11111111-1111-4111-8111-111111111111';
const DINING = '22222222-2222-4222-8222-222222222222';

const options: CategoryOption[] = [
  { id: GROCERIES, name: 'Groceries', color: '#337dff', icon: null },
  { id: DINING, name: 'Dining out', color: '#f97316', icon: null },
];

// The native half of the same component. Importing the shared barrel here must
// land on category-select.native.tsx, which opens a Modal rather than rendering
// a <select> — the platform split is only real if both halves are exercised.
describe('CategorySelect (native)', () => {
  it('shows the placeholder until something is chosen', () => {
    render(<CategorySelect options={options} onChange={jest.fn<Change>()} />);

    expect(screen.getByText('No category')).toBeTruthy();
  });

  it('shows the current selection on the trigger', () => {
    render(<CategorySelect options={options} value={DINING} onChange={jest.fn<Change>()} />);

    expect(screen.getByText('Dining out')).toBeTruthy();
  });

  // The list is behind a modal, so nothing should be reachable until it opens.
  it('does not render the options until opened', () => {
    render(<CategorySelect options={options} onChange={jest.fn<Change>()} />);

    expect(screen.queryByTestId(`category-select-option-${GROCERIES}`)).toBeNull();
  });

  it('reports the chosen id and closes', () => {
    const onChange = jest.fn<Change>();
    render(<CategorySelect options={options} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('category-select'));
    fireEvent.press(screen.getByTestId(`category-select-option-${DINING}`));

    expect(onChange).toHaveBeenCalledWith(DINING);
    expect(screen.queryByTestId(`category-select-option-${DINING}`)).toBeNull();
  });

  // An expense with no category is legitimate, so there has to be a way back.
  it('reports undefined when the empty choice is taken', () => {
    const onChange = jest.fn<Change>();
    render(<CategorySelect options={options} value={DINING} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('category-select'));
    fireEvent.press(screen.getByTestId('category-select-option-none'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  // Tapping outside a sheet is how people dismiss one, and it must not count as
  // choosing anything.
  it('closes on the backdrop without changing the value', () => {
    const onChange = jest.fn<Change>();
    render(<CategorySelect options={options} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('category-select'));
    fireEvent.press(screen.getByTestId('category-select-backdrop'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId(`category-select-option-${GROCERIES}`)).toBeNull();
  });

  it('does not open when disabled', () => {
    render(<CategorySelect options={options} onChange={jest.fn<Change>()} disabled />);

    fireEvent.press(screen.getByTestId('category-select'));

    expect(screen.queryByTestId(`category-select-option-${GROCERIES}`)).toBeNull();
  });
});
