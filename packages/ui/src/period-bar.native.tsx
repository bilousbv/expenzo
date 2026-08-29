import { Pressable, Text, View } from 'react-native';

import {
  periodArrowClass,
  periodArrowGlyphClass,
  periodArrowSpacerClass,
  periodBarClass,
  periodCentreClass,
  periodDatesClass,
  periodLabelClass,
  type PeriodBarProps,
} from './period-bar.styles';

/**
 * React Native implementation, resolved by Metro through the `.native` suffix.
 *
 * Same rules as the web half: the arrows step whole months and only exist while
 * the period is one, and the centre carries the name over the exact dates.
 */
export function PeriodBar({
  label,
  dates,
  onStep,
  onOpen,
  openLabel,
  previousLabel,
  nextLabel,
  className,
  testID = 'period-bar',
}: PeriodBarProps) {
  return (
    <View testID={testID} className={periodBarClass(className)}>
      {onStep ? (
        <Pressable
          testID="period-previous"
          accessibilityRole="button"
          accessibilityLabel={previousLabel}
          onPress={() => onStep(-1)}
          className={periodArrowClass}
        >
          <Text className={periodArrowGlyphClass}>‹</Text>
        </Pressable>
      ) : (
        // Holds the space so the label does not jump sideways when a custom
        // range hides the arrows.
        <View className={periodArrowSpacerClass} />
      )}

      <Pressable
        testID="period-open"
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        onPress={onOpen}
        className={periodCentreClass}
      >
        <Text testID="period-label" className={periodLabelClass}>
          {label}
        </Text>
        <Text testID="period-dates" className={periodDatesClass}>
          {dates}
        </Text>
      </Pressable>

      {onStep ? (
        <Pressable
          testID="period-next"
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          onPress={() => onStep(1)}
          className={periodArrowClass}
        >
          <Text className={periodArrowGlyphClass}>›</Text>
        </Pressable>
      ) : (
        <View className={periodArrowSpacerClass} />
      )}
    </View>
  );
}
