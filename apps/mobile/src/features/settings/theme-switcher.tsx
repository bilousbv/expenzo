import { useTranslation } from '@expenzo/i18n';
import { Button, THEMES, type Theme } from '@expenzo/ui';
import { Text, View } from 'react-native';

import { useTheme } from '../../lib/theme';

/**
 * Picks the colour scheme.
 *
 * Segmented buttons rather than the shared select: there are exactly two
 * choices and both fit, so a picker that has to be opened to show them is a tap
 * spent on nothing.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-content-muted">{t('settings.appearance')}</Text>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.appearance')}
        className="flex-row gap-2"
      >
        {THEMES.map((option: Theme) => (
          <Button
            key={option}
            testID={`theme-${option}`}
            variant={theme === option ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTheme(option)}
          >
            {t(`settings.theme.${option}`)}
          </Button>
        ))}
      </View>
    </View>
  );
}
