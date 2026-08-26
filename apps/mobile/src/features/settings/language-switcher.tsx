import { LOCALE_LABEL, locales, useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { Pressable, Text, View } from 'react-native';

import { useLocale } from '../../lib/i18n';

/**
 * Two choices sit better as a visible pair than behind a picker, and this
 * matches the period and author controls on the dashboard rather than
 * introducing a third pattern for the same job.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-content-muted">{t('common.language')}</Text>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('common.language')}
        className="flex-row gap-2"
      >
        {locales.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: locale === option }}
            testID={`language-${option}`}
            onPress={() => setLocale(option)}
            className={buttonContainerClass(locale === option ? 'primary' : 'secondary', 'sm')}
          >
            {/* Each language named in itself, so somebody who cannot read the
                one currently on screen can still find theirs. */}
            <Text className={buttonLabelClass(locale === option ? 'primary' : 'secondary', 'sm')}>
              {LOCALE_LABEL[option]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
