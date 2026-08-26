import {
  useCategories,
  useCurrentHousehold,
  useDeleteExpense,
  useExpenses,
  useHouseholdMembers,
} from '@expenzo/data';
import type { ExpenseFilter } from '@expenzo/domain';
import { Button, Card, categoryDotClass, categoryDotStyle, formatCurrency } from '@expenzo/ui';
import { useTranslation } from '@expenzo/i18n';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * The chronological list.
 *
 * Takes its filter from the dashboard rather than owning one: the period and
 * author controls sit above the whole screen, and a list with its own copy
 * would disagree with the totals sitting next to it.
 */
export function ExpenseListView({ filter }: { filter: ExpenseFilter }) {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const baseCurrency = household.data?.base_currency;

  const categories = useCategories(householdId);
  const members = useHouseholdMembers(householdId);
  const expenses = useExpenses({ householdId, filter });
  const remove = useDeleteExpense(householdId);

  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const authorFor = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const rows = (expenses.data ?? []).flatMap((page) => page.rows);

  return (
    <Card className="gap-gutter">
      {expenses.isPending ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text testID="no-expenses" className="text-sm text-content-muted">
          {t('expenses.nothingRecorded')}
        </Text>
      ) : (
        rows.map((row) => {
          const category = row.category_id ? categoryById.get(row.category_id) : undefined;
          const income = row.direction === 'income';

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
                    <View className={categoryDotClass()} style={categoryDotStyle(category.color)} />
                  ) : null}
                  <Text testID="expense-author" className="text-xs text-content-muted">
                    {category?.name ?? t('common.uncategorised')} · {row.occurred_on} ·{' '}
                    {authorFor.get(row.created_by) ?? t('common.member')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="items-end">
                  {/* Income is signed here for the reader's benefit only — the
                      stored amount is positive and the direction carries the
                      meaning. */}
                  <Text
                    testID="expense-amount"
                    className={income ? 'text-green-700' : 'text-content'}
                  >
                    {income ? '+' : ''}
                    {formatCurrency(row.amount_minor, row.currency)}
                  </Text>

                  {/* What this row contributed to the totals above. Shown only
                      when it differs, so the common case stays uncluttered and a
                      foreign amount never looks like it was ignored. */}
                  {baseCurrency && row.currency !== baseCurrency ? (
                    <Text testID="expense-base-amount" className="text-xs text-content-muted">
                      ≈ {formatCurrency(row.base_amount_minor, baseCurrency)}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('expenses.deleteLabel', {
                    name: row.merchant ?? t('expenses.fallbackName'),
                  })}
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
          {t(expenses.isFetchingNextPage ? 'common.loading' : 'expenses.loadMore')}
        </Button>
      ) : null}
    </Card>
  );
}
