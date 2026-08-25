import {
  categoryChipClass,
  categoryChipLabelClass,
  categoryDotClass,
  categoryDotStyle,
} from './category-chip.styles';
import {
  categoryPickerClass,
  categoryPickerEmptyClass,
  type CategoryPickerProps,
} from './category-picker.styles';

/** Web implementation. Metro picks `category-picker.native.tsx` instead. */
export function CategoryPicker({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
  testID = 'category-picker',
}: CategoryPickerProps) {
  if (options.length === 0) {
    return (
      <p data-testid={`${testID}-empty`} className={categoryPickerEmptyClass()}>
        No categories yet.
      </p>
    );
  }

  return (
    // role="radio" on buttons rather than real radio inputs: a checked radio
    // fires no change event when it is clicked again, and pressing the current
    // selection is how the category is cleared.
    <div role="radiogroup" aria-label={label} data-testid={testID} className={className}>
      <div className={categoryPickerClass()}>
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              data-testid={`category-chip-${option.id}`}
              onClick={() => onChange(selected ? undefined : option.id)}
              className={categoryChipClass(selected, disabled ? 'opacity-50' : undefined)}
            >
              <span
                aria-hidden
                className={categoryDotClass()}
                style={categoryDotStyle(option.color)}
              />
              <span className={categoryChipLabelClass(selected)}>{option.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
