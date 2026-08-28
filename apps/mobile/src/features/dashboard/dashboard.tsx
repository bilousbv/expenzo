import {
  useCategories,
  useCategorySpend,
  useCurrentHousehold,
  useDisplayCurrency,
  useHouseholdMembers,
  useLimits,
  usePeriodSummary,
} from '@expenzo/data';
import { limitProgress, PERIOD_PRESETS, presetRange, type PeriodPreset } from '@expenzo/domain';
import {
  Button,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatApprox,
  GradientSurface,
  type CategoryOption,
} from '@expenzo/ui';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
import { ActivityIndicator, Text, View } from 'react-native';

import { ExpenseListView } from '../expenses/expense-list';

export function Dashboard() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  /*
   * What this member reads in. The household still records everything in its
   * own currency; this converts on the way to the screen, so two people can
   * read one ledger in two currencies without either of them changing it.
   */
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const [memberId, setMemberId] = useState<string | undefined>(undefined);

  // Resolved in the household's timezone, so an expense entered late in the
  // evening belongs to the month it was entered in there rather than in UTC.
  const range = useMemo(() => presetRange(preset, new Date(), timeZone), [preset, timeZone]);
  const window = useMemo(
    () => ({ from: range.start, to: range.end, memberId }),
    [range.start, range.end, memberId],
  );

  const members = useHouseholdMembers(householdId);
  const categories = useCategories(householdId);
  const limits = useLimits(householdId);
  const summary = usePeriodSummary(householdId, window);
  const categorySpend = useCategorySpend(householdId, window);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));
  const categoryById = new Map(options.map((option) => [option.id, option]));
  const limitFor = new Map(
    (limits.data ?? []).map((limit) => [limit.category_id, limit.amount_minor]),
  );

  const breakdown = (categorySpend.data ?? [])
    .map((entry) => ({
      categoryId: entry.categoryId,
      // Expenses with no category still sum to something, and dropping them
      // would make the rollup disagree with the period total.
      name: entry.categoryId
        ? (categoryById.get(entry.categoryId)?.name ?? t('limits.fallbackCategory'))
        : t('common.uncategorised'),
      color: entry.categoryId ? (categoryById.get(entry.categoryId)?.color ?? null) : null,
      spentMinor: entry.totalMinor,
      limitMinor: limitFor.get(entry.categoryId) ?? null,
    }))
    .sort((a, b) => b.spentMinor - a.spentMinor);

  const balance = summary.data?.balanceMinor ?? 0;

  return (
    <View>
      {/* The one surface in the app that is not a white card on grey. The point
          is that "how are we doing" should be legible from arm's length, which
          a figure set in the same size as its neighbours is not. */}
      <GradientSurface className="rounded-b-card px-gutter pb-gutter pt-6">
        <View className="items-center gap-2 py-8">
          <Text className="text-sm text-content-inverse/70">{t('dashboard.leftThisPeriod')}</Text>
          {/* Not reddened when negative: on a dark panel red reads as an error
              rather than as a number, and the minus sign already says it. */}
          <Text testID="budget-balance" className="text-5xl font-bold text-content-inverse">
            {formatApprox(display.convert(balance), display.currency, display.approximate)}
          </Text>
        </View>

        <View className="flex-row rounded-card bg-black/15 px-gutter py-4">
          <View className="flex-1 items-center gap-1">
            <Text className="text-xs text-content-inverse/70">{t('dashboard.income')}</Text>
            <Text testID="budget-income" className="text-lg font-semibold text-content-inverse">
              {formatApprox(
                display.convert(summary.data?.incomeMinor ?? 0),
                display.currency,
                display.approximate,
              )}
            </Text>
          </View>

          <View className="w-px bg-content-inverse/20" />

          <View className="flex-1 items-center gap-1">
            <Text className="text-xs text-content-inverse/70">{t('dashboard.spent')}</Text>
            <Text testID="budget-spent" className="text-lg font-semibold text-content-inverse">
              {formatApprox(
                display.convert(summary.data?.spentMinor ?? 0),
                display.currency,
                display.approximate,
              )}
            </Text>
          </View>
        </View>

        <Text className="pt-3 text-center text-xs text-content-inverse/60">
          {t('dashboard.wholePeriodNote')}
        </Text>
      </GradientSurface>

      <View className="gap-gutter p-gutter">
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('dashboard.period')}
          className="flex-row flex-wrap gap-2"
        >
          {PERIOD_PRESETS.map((option) => (
            <Button
              key={option}
              testID={`period-${option}`}
              variant={preset === option ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setPreset(option)}
            >
              {t(`period.${option}`)}
            </Button>
          ))}
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('dashboard.author')}
          className="flex-row flex-wrap gap-2"
        >
          <Button
            testID="author-all"
            variant={memberId === undefined ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setMemberId(undefined)}
          >
            {t('common.everyone')}
          </Button>

          {(members.data ?? []).map((member) => (
            <Button
              key={member.userId}
              testID={`author-${member.userId}`}
              variant={memberId === member.userId ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setMemberId(member.userId)}
            >
              {member.displayName}
            </Button>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-content">{t('expenses.title')}</Text>
          <Button testID="new-expense" size="sm" onPress={() => router.push('/expense/new')}>
            Add
          </Button>
        </View>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">By category</Text>

          {categorySpend.isPending ? (
            <ActivityIndicator />
          ) : breakdown.length === 0 ? (
            <Text testID="no-category-spend" className="text-sm text-content-muted">
              {t('dashboard.nothingSpent')}
            </Text>
          ) : (
            breakdown.map((row) => {
              const progress = limitProgress(row.spentMinor, row.limitMinor);

              return (
                <View
                  key={row.categoryId ?? 'uncategorised'}
                  testID="category-row"
                  className="gap-1"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className={categoryDotClass()} style={categoryDotStyle(row.color)} />
                      <Text className="text-content">{row.name}</Text>
                    </View>
                    <Text
                      testID="category-amount"
                      className={progress.exceeded ? 'text-red-600' : 'text-content'}
                    >
                      {formatApprox(
                        display.convert(row.spentMinor),
                        display.currency,
                        display.approximate,
                      )}
                      {progress.limitMinor !== null
                        ? ` / ${formatApprox(display.convert(progress.limitMinor), display.currency, display.approximate)}`
                        : ''}
                    </Text>
                  </View>

                  {/* Only categories with a limit get a bar — one with nothing
                    behind it would be measuring against nothing. */}
                  {progress.ratio !== null ? (
                    <View className="h-2 w-full overflow-hidden rounded-full bg-brand-100">
                      <View
                        // Capped so an overspend does not paint outside the
                        // track; the figures above already say by how much.
                        style={{ width: `${Math.min(progress.ratio, 1) * 100}%` }}
                        className={`h-full ${progress.exceeded ? 'bg-red-600' : 'bg-brand-600'}`}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>

        <ExpenseListView filter={window} />
      </View>
    </View>
  );
}
