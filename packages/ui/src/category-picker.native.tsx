import { Pressable, Text, View } from 'react-native';

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

/** React Native implementation, resolved by Metro through the `.native` suffix. */
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
      <Text testID={`${testID}-empty`} className={categoryPickerEmptyClass()}>
        No categories yet.
      </Text>
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
      className={className}
    >
      <View className={categoryPickerClass()}>
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              // VoiceOver and TalkBack read selection from here, not from the
              // border colour.
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              testID={`category-chip-${option.id}`}
              onPress={() => onChange(selected ? undefined : option.id)}
              className={categoryChipClass(selected, disabled ? 'opacity-50' : undefined)}
            >
              <View className={categoryDotClass()} style={categoryDotStyle(option.color)} />
              <Text className={categoryChipLabelClass(selected)}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
