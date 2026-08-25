import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CategoryPicker, type CategoryOption } from '@expenzo/ui';

const options: CategoryOption[] = [
  { id: 'a', name: 'Groceries', color: '#337dff', icon: 'shopping-cart' },
  { id: 'b', name: 'Dining out', color: '#f97316', icon: 'utensils' },
  { id: 'c', name: 'Coffee', color: null, icon: null },
];

// The native half of the same component. Importing the shared barrel here must
// land on category-picker.native.tsx, which renders Pressables rather than
// inputs — the platform split is only real if both halves are exercised.
describe('CategoryPicker (native)', () => {
  it('renders one chip per category', () => {
    render(<CategoryPicker options={options} onChange={jest.fn<(id?: string) => void>()} />);

    expect(screen.getByTestId('category-chip-a')).toBeTruthy();
    expect(screen.getByTestId('category-chip-b')).toBeTruthy();
    expect(screen.getByTestId('category-chip-c')).toBeTruthy();
  });

  it('reports the chosen id', () => {
    const onChange = jest.fn<(id?: string) => void>();
    render(<CategoryPicker options={options} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('category-chip-c'));

    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('clears the selection when the selected chip is pressed again', () => {
    const onChange = jest.fn<(id?: string) => void>();
    render(<CategoryPicker options={options} value="c" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('category-chip-c'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  // VoiceOver and TalkBack read the selected state from accessibilityState,
  // not from the border colour.
  it('marks the selected chip for the screen reader', () => {
    render(
      <CategoryPicker options={options} value="b" onChange={jest.fn<(id?: string) => void>()} />,
    );

    expect(screen.getByTestId('category-chip-b').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('category-chip-a').props.accessibilityState.selected).toBe(false);
  });

  it('does not fire when disabled', () => {
    const onChange = jest.fn<(id?: string) => void>();
    render(<CategoryPicker options={options} onChange={onChange} disabled />);

    fireEvent.press(screen.getByTestId('category-chip-a'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so rather than rendering an empty strip', () => {
    render(<CategoryPicker options={[]} onChange={jest.fn<(id?: string) => void>()} />);

    expect(screen.getByTestId('category-picker-empty')).toBeTruthy();
  });
});
