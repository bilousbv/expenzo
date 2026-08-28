import {
  useCategories,
  useCurrentHousehold,
  useDeleteExpense,
  useDisplayCurrency,
  useExpenses,
  useHouseholdMembers,
} from '@expenzo/data';
import { groupByDay, localDateIn, relativeDayKey, type ExpenseFilter } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  Button,
  Card,
  formatApprox,
  formatCurrency,
  IconTile,
  iconTileGlyphClass,
  iconTileGlyphStyle,
  monogramFor,
} from '@expenzo/ui';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * The chronological list, grouped by day.
 *
 * Takes its filter from the dashboard rather than owning one: the period and
 * author controls sit above the whole screen, and a list with its own copy
 * would disagree with the totals sitting next to it.
 */
export function ExpenseListView({ filter }: { filter: ExpenseFilter }) {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  // What this member reads in; the household still records in its own.
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const categories = useCategories(householdId);
  const members = useHouseholdMembers(householdId);
  const expenses = useExpenses({ householdId, filter });
  const remove = useDeleteExpense(householdId);

  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const authorFor = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const rows = (expenses.data ?? []).flatMap((page) => page.rows);
  const days = groupByDay(rows, (row) => row.occurred_on);
  const today = localDateIn(new Date(), timeZone);

  if (expenses.isPending) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <Text testID="no-expenses" className="text-sm text-content-muted">
          {t('expenses.nothingRecorded')}
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-gutter">
      {days.map((day) => {
        const relative = relativeDayKey(day.date, today);
        // Net for the day, summed in the household's own currency so a day
        // holding two currencies still adds to one figure.
        const netMinor = day.items.reduce(
          (total, row) =>
            row.direction === 'income'
              ? total + row.base_amount_minor
              : total - row.base_amount_minor,
          0,
        );

        return (
          <View key={day.date} className="gap-2">
            <View className="flex-row items-baseline justify-between px-1">
              <Text className="text-sm font-medium text-content">
                {relative ? t(`common.${relative}`) : day.date}
              </Text>
              <Text
                testID="day-total"
                className={`text-sm ${netMinor > 0 ? 'text-positive' : 'text-content-muted'}`}
              >
                {netMinor > 0 ? '+' : ''}
                {formatApprox(display.convert(netMinor), display.currency, display.approximate)}
              </Text>
            </View>

            {/* One card per day rather than one per row: the rows inside share
                a surface and are separated by rules, which is what makes the
                grouping read as a group. */}
            <Card className="gap-0 p-0">
              {day.items.map((row, index) => {
                const category = row.category_id ? categoryById.get(row.category_id) : undefined;
                const income = row.direction === 'income';

                return (
                  <View
                    key={row.id}
                    testID="expense-row"
                    className={`flex-row items-center gap-3 px-gutter py-3 ${
                      index > 0 ? 'border-t border-surface-muted' : ''
                    }`}
                  >
                    <IconTile color={category?.color ?? null}>
                      <Text
                        className={iconTileGlyphClass}
                        style={iconTileGlyphStyle(category?.color ?? null)}
                      >
                        {monogramFor(row.merchant ?? category?.name)}
                      </Text>
                    </IconTile>

                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-content">
                        {row.merchant ?? t('expenses.fallbackName')}
                      </Text>
                      <Text numberOfLines={1} className="text-xs text-content-muted">
                        {category ? category.name : t('common.uncategorised')} ·{' '}
                        {authorFor.get(row.created_by) ?? t('common.member')}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-3">
                      <View className="items-end">
                        {/* Income is signed here for the reader's benefit only
                            — the stored amount is positive and the direction
                            carries the meaning. */}
                        <Text
                          testID="expense-amount"
                          className={income ? 'font-semibold text-positive' : 'text-content'}
                        >
                          {income ? '+' : ''}
                          {formatCurrency(row.amount_minor, row.currency)}
                        </Text>

                        {row.currency !== display.currency ? (
                          <Text testID="expense-base-amount" className="text-xs text-content-muted">
                            {/* Always marked: this figure was converted
                                whichever currency the reader is in. */}
                            {formatApprox(
                              display.convert(row.base_amount_minor),
                              display.currency,
                              true,
                            )}
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
                        <Text className="text-content-muted">×</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}

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
    </View>
  );
}
