import { Text, View } from 'react-native';

import {
  savedAmountClass,
  savedCardClass,
  savedExplainerClass,
  savedGlyph,
  savedIconClass,
  savedIconGlyphClass,
  savedTitleClass,
  type SavedCardProps,
} from './saved-card.styles';

/**
 * React Native implementation, resolved by Metro through the `.native` suffix.
 *
 * Same single line as the web half: icon, what it is, and the figure.
 */
export function SavedCard({
  savedMinor,
  savedLabel,
  title,
  explainer,
  className,
  testID = 'saved-card',
}: SavedCardProps) {
  return (
    <View testID={testID} className={savedCardClass(className)}>
      <View className={savedIconClass}>
        <Text className={savedIconGlyphClass}>=</Text>
      </View>

      <View className="flex-1">
        <Text className={savedTitleClass}>{title}</Text>
        <Text className={savedExplainerClass}>{explainer}</Text>
      </View>

      <Text testID="saved-amount" className={savedAmountClass(savedMinor)}>
        {savedGlyph(savedMinor)} {savedLabel}
      </Text>
    </View>
  );
}
