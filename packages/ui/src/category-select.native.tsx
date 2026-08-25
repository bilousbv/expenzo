import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { categoryDotClass, categoryDotStyle } from './category-chip.styles';
import {
  selectLabelClass,
  selectTriggerClass,
  type CategorySelectProps,
} from './category-select.styles';

/**
 * React Native implementation, resolved by Metro through the `.native` suffix.
 *
 * A Pressable opening a Modal list rather than `@react-native-picker/picker`:
 * that dependency would have to be version-matched to the Expo SDK on every
 * upgrade, and a styled list matches the rest of the app where a platform wheel
 * would not.
 */
export function CategorySelect({
  options,
  value,
  onChange,
  label = 'Category',
  placeholder = 'No category',
  disabled = false,
  className,
  testID = 'category-select',
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.id === value);

  function choose(id: string | undefined) {
    onChange(id);
    setOpen(false);
  }

  return (
    <View className={className}>
      <Text className={selectLabelClass}>{label}</Text>

      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.name ?? placeholder }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={selectTriggerClass(disabled)}
      >
        <View className="flex-row items-center gap-2">
          {selected ? (
            <View className={categoryDotClass()} style={categoryDotStyle(selected.color)} />
          ) : null}
          <Text className="text-content">{selected?.name ?? placeholder}</Text>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Android's hardware back button dismisses the modal rather than the
        // screen behind it, which is what a picker should do.
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID={`${testID}-backdrop`}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="rounded-t-card bg-surface p-gutter max-h-96">
            <ScrollView>
              <Pressable
                testID={`${testID}-option-none`}
                accessibilityRole="button"
                onPress={() => choose(undefined)}
                className="py-3"
              >
                <Text className="text-content">{placeholder}</Text>
              </Pressable>

              {options.map((option) => (
                <Pressable
                  key={option.id}
                  testID={`${testID}-option-${option.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.id === value }}
                  onPress={() => choose(option.id)}
                  className="flex-row items-center gap-2 py-3"
                >
                  <View className={categoryDotClass()} style={categoryDotStyle(option.color)} />
                  <Text className="text-content">{option.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
