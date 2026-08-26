import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import {
  currencyOptions,
  selectLabelClass,
  selectTriggerClass,
  type CurrencySelectProps,
} from './currency-select.styles';

/**
 * React Native implementation, resolved by Metro through the `.native` suffix.
 *
 * A Pressable opening a Modal list, matching the category select rather than
 * adding a platform picker dependency that would need version-matching to the
 * Expo SDK on every upgrade.
 */
export function CurrencySelect({
  currencies,
  value,
  onChange,
  label = 'Currency',
  disabled = false,
  className,
  testID = 'currency-select',
}: CurrencySelectProps) {
  const [open, setOpen] = useState(false);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <View className={className}>
      <Text className={selectLabelClass}>{label}</Text>

      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={selectTriggerClass(disabled)}
      >
        <Text className="text-content">{value}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Android's hardware back button should dismiss the picker rather than
        // the screen behind it.
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
              {currencyOptions(currencies, value).map((code) => (
                <Pressable
                  key={code}
                  testID={`${testID}-option-${code}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: code === value }}
                  onPress={() => choose(code)}
                  className="py-3"
                >
                  <Text className="text-content">{code}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
