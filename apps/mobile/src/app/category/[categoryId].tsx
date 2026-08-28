import { useCategories, useCurrentHousehold } from '@expenzo/data';
import { categoryFilter, UNCATEGORISED } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseListView } from '../../features/expenses/expense-list';

/**
 * One category's expenses, grouped by day.
 *
 * A pushed screen rather than an expanding row on the dashboard: the back
 * gesture does the obvious thing, and the dashboard stays a summary instead of
 * growing a list underneath every category.
 *
 * `from` and `to` travel from the dashboard so this opens on the period the
 * rollup was showing rather than resetting to this month.
 */
export default function CategoryScreen() {
  const { t } = useTranslation();
  const { categoryId, from, to } = useLocalSearchParams<{
    categoryId: string;
    from?: string;
    to?: string;
  }>();

  const household = useCurrentHousehold();
  const categories = useCategories(household.data?.id);

  const name =
    categoryId === UNCATEGORISED
      ? t('common.uncategorised')
      : ((categories.data ?? []).find((category) => category.id === categoryId)?.name ??
        t('limits.fallbackCategory'));

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <Text testID="category-title" className="text-2xl font-bold text-content">
          {name}
        </Text>

        {from && to ? (
          <Text testID="category-range" className="text-xs text-content-muted">
            {from} {t('dashboard.rangeSeparator')} {to}
          </Text>
        ) : null}

        <ExpenseListView filter={{ from, to, ...categoryFilter(categoryId) }} />
      </ScrollView>
    </SafeAreaView>
  );
}
