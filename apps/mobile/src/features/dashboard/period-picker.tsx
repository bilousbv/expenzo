import { PERIOD_PRESETS, presetRange, type DateRange, type PeriodPreset } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, Card, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

export interface PeriodPickerProps {
  open: boolean;
  onClose: () => void;
  /** The period in force, so the custom fields open on it rather than empty. */
  range: DateRange;
  timeZone: string;
  onPick: (range: DateRange) => void;
}

/**
 * Presets and a custom range, behind the period bar.
 *
 * A Modal rather than a platform date picker: two of those would need
 * version-matching to the Expo SDK on every upgrade, and the presets are the
 * answer nearly every time — the typed range is the escape hatch beneath them.
 */
export function PeriodPicker({ open, onClose, range, timeZone, onPick }: PeriodPickerProps) {
  const { t } = useTranslation();
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);

  /*
   * Reopened on a different period, the fields have to show that one rather
   * than whatever was typed and abandoned last time.
   *
   * Adjusted during render rather than in an effect: setting state from an
   * effect renders once with the stale value and again with the right one, and
   * the linter is right that it cascades.
   */
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setFrom(range.start);
      setTo(range.end);
    }
  }

  const reversed = from > to;

  function choosePreset(preset: PeriodPreset) {
    onPick(presetRange(preset, new Date(), timeZone));
    onClose();
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        testID="period-backdrop"
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        className="flex-1 justify-end bg-black/40"
      >
        <Card className="gap-gutter rounded-b-none">
          <Text className="text-lg font-semibold text-content">{t('period.pick')}</Text>

          <View className="flex-row flex-wrap gap-2">
            {PERIOD_PRESETS.map((preset) => (
              <Button
                key={preset}
                testID={`preset-${preset}`}
                variant="secondary"
                size="sm"
                onPress={() => choosePreset(preset)}
              >
                {t(`period.${preset}`)}
              </Button>
            ))}
          </View>

          <View className="flex-row gap-gutter">
            <View className="flex-1 gap-1">
              <Text className="text-sm font-medium text-content-muted">{t('period.from')}</Text>
              <TextInput
                testID="period-from"
                value={from}
                onChangeText={setFrom}
                autoCapitalize="none"
                placeholder={t('expenses.datePlaceholder')}
                className={fieldInputClass()}
              />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-sm font-medium text-content-muted">{t('period.to')}</Text>
              <TextInput
                testID="period-to"
                value={to}
                onChangeText={setTo}
                autoCapitalize="none"
                placeholder={t('expenses.datePlaceholder')}
                className={fieldInputClass()}
              />
            </View>
          </View>

          {/* Refused rather than quietly swapped: a reversed range is a typo,
              and silently reinterpreting it hides which end was wrong. */}
          {reversed ? (
            <Text testID="period-error" className="text-sm text-negative">
              {t('period.reversed')}
            </Text>
          ) : null}

          <Button
            testID="period-apply"
            disabled={reversed}
            onPress={() => {
              if (reversed) return;
              onPick({ start: from, end: to });
              onClose();
            }}
          >
            {t('period.apply')}
          </Button>
        </Card>
      </Pressable>
    </Modal>
  );
}
