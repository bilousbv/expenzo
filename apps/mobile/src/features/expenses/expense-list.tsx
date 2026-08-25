import { useCategories, useCurrentHousehold, useDeleteExpense, useExpenses } from '@expenzo/data';
import type { ExpenseFilter } from '@expenzo/domain';
import {
  Button,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatCurrency,
  type CategoryOption,
} from '@expenzo/ui';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'shared', label: 'Shared' },
  { value: 'personal', label: 'Personal' },
] as const;

export function ExpenseListView() {
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';

  const [scope, setScope] = useState<ExpenseFilter['scope']>('all');
  const filter = useMemo(() => ({ scope }), [scope]);

  const categories = useCategories(householdId);
  const expenses = useExpenses({ householdId, filter });
  const remove = useDeleteExpense(householdId);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));
  const nameFor = new Map(options.map((option) => [option.id, option]));

  const rows = (expenses.data ?? []).flatMap((page) => page.rows);

  // The visible total only, and labelled as such. Calling a running sum of the
  // loaded pages "total spent" would be a lie the moment there is a page two.
  const visibleTotal = rows.reduce((sum, row) => sum + row.base_amount_minor, 0);

  return (
    <View className="gap-gutter">
      <Card className="gap-2">
        <Text className="text-sm text-content-muted">Total of the {rows.length} shown</Text>
        <Text testID="visible-total" className="text-4xl font-semibold text-content">
          {formatCurrency(visibleTotal, currency)}
        </Text>
      </Card>

      <View accessibilityRole="radiogroup" accessibilityLabel="Scope" className="flex-row gap-2">
        {SCOPES.map((option) => (
          <Button
            key={option.value}
            testID={`scope-${option.value}`}
            variant={scope === option.value ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setScope(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </View>

      <Card className="gap-gutter">
        {expenses.isPending ? (
          <ActivityIndicator />
        ) : rows.length === 0 ? (
          <Text testID="no-expenses" className="text-sm text-content-muted">
            Nothing recorded yet.
          </Text>
        ) : (
          rows.map((row) => {
            const category = row.category_id ? nameFor.get(row.category_id) : undefined;

            return (
              <View
                key={row.id}
                testID="expense-row"
                className="flex-row items-center justify-between border-b border-brand-100 pb-2"
              >
                <View>
                  <Text className="text-content">{row.merchant ?? 'Expense'}</Text>
                  <View className="flex-row items-center gap-2">
                    {category ? (
                      <View
                        className={categoryDotClass()}
                        style={categoryDotStyle(category.color)}
                      />
                    ) : null}
                    <Text className="text-xs text-content-muted">
                      {category?.name ?? 'Uncategorised'} · {row.occurred_on}
                      {row.visibility === 'personal' ? ' · Personal' : ''}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <Text testID="expense-amount" className="text-content">
                    {formatCurrency(row.amount_minor, row.currency)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${row.merchant ?? 'expense'}`}
                    disabled={remove.isPending}
                    onPress={() => remove.mutate(row.id)}
                  >
                    <Text className="text-sm text-content-muted">×</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {expenses.hasNextPage ? (
          <Button
            testID="load-more"
            variant="secondary"
            disabled={expenses.isFetchingNextPage}
            onPress={() => void expenses.fetchNextPage()}
          >
            {expenses.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        ) : null}
      </Card>
    </View>
  );
}
