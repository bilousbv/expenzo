import {
  useCategories,
  useCategorySpend,
  useCurrentHousehold,
  useHouseholdMembers,
  useLimits,
  usePeriodSummary,
} from '@expenzo/data';
import {
  limitProgress,
  PERIOD_PRESET_LABELS,
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from '@expenzo/domain';
import {
  Button,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatCurrency,
  type CategoryOption,
} from '@expenzo/ui';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ExpenseListView } from '../expenses/expense-list';

export function Dashboard() {
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';
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
        ? (categoryById.get(entry.categoryId)?.name ?? 'Category')
        : 'Uncategorised',
      color: entry.categoryId ? (categoryById.get(entry.categoryId)?.color ?? null) : null,
      spentMinor: entry.totalMinor,
      limitMinor: limitFor.get(entry.categoryId) ?? null,
    }))
    .sort((a, b) => b.spentMinor - a.spentMinor);

  const balance = summary.data?.balanceMinor ?? 0;

  return (
    <View className="gap-gutter">
      <Card className="gap-2">
        <Text className="text-sm text-content-muted">Left this period</Text>
        <Text
          testID="budget-balance"
          className={`text-4xl font-semibold ${balance < 0 ? 'text-red-600' : 'text-content'}`}
        >
          {formatCurrency(balance, currency)}
        </Text>

        <View className="flex-row gap-gutter">
          <View>
            <Text className="text-xs text-content-muted">Income</Text>
            <Text testID="budget-income" className="text-content">
              {formatCurrency(summary.data?.incomeMinor ?? 0, currency)}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-content-muted">Spent</Text>
            <Text testID="budget-spent" className="text-content">
              {formatCurrency(summary.data?.spentMinor ?? 0, currency)}
            </Text>
          </View>
        </View>
      </Card>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Period"
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
            {PERIOD_PRESET_LABELS[option]}
          </Button>
        ))}
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Author"
        className="flex-row flex-wrap gap-2"
      >
        <Button
          testID="author-all"
          variant={memberId === undefined ? 'primary' : 'secondary'}
          size="sm"
          onPress={() => setMemberId(undefined)}
        >
          Everyone
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
        <Text className="text-xl font-semibold text-content">Expenses</Text>
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
            Nothing spent in this period.
          </Text>
        ) : (
          breakdown.map((row) => {
            const progress = limitProgress(row.spentMinor, row.limitMinor);

            return (
              <View key={row.categoryId ?? 'uncategorised'} testID="category-row" className="gap-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className={categoryDotClass()} style={categoryDotStyle(row.color)} />
                    <Text className="text-content">{row.name}</Text>
                  </View>
                  <Text
                    testID="category-amount"
                    className={progress.exceeded ? 'text-red-600' : 'text-content'}
                  >
                    {formatCurrency(row.spentMinor, currency)}
                    {progress.limitMinor !== null
                      ? ` / ${formatCurrency(progress.limitMinor, currency)}`
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
  );
}
