import {
  useBudgetSummary,
  useCategories,
  useCategorySpend,
  useCurrentHousehold,
  useDisplayCurrency,
  useHouseholdMembers,
  useLimits,
  usePostSubscriptionCharges,
  useUpcomingRenewals,
} from '@expenzo/data';
import {
  describePeriod,
  periodUnit,
  limitProgress,
  localDateIn,
  presetRange,
  renewalWindow,
  shiftPeriod,
  subscriptionChargeWindow,
  UNCATEGORISED,
  type DateRange,
} from '@expenzo/domain';
import {
  Button,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatApprox,
  formatMonthLabel,
  formatRange,
  GradientSurface,
  PeriodBar,
  SavedCard,
  type CategoryOption,
} from '@expenzo/ui';
import { router } from 'expo-router';
import { PeriodPicker } from './period-picker';
import { UpcomingRenewals } from './upcoming-renewals';
import { useMemo, useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  /*
   * What this member reads in. The household still records everything in its
   * own currency; this converts on the way to the screen, so two people can
   * read one ledger in two currencies without either of them changing it.
   */
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);

  /*
   * Held on the screen rather than in the URL: there is no address bar to put
   * it in, and the category screen is handed the dates through its route
   * params, which is the same idea by another means.
   *
   * Resolved in the household's timezone, so an expense entered late in the
   * evening belongs to the month it was entered in there rather than in UTC.
   */
  const [range, setRange] = useState<DateRange>(() =>
    presetRange('this-month', new Date(), timeZone),
  );

  const window = useMemo(
    () => ({ from: range.start, to: range.end, memberId }),
    [range.start, range.end, memberId],
  );

  const members = useHouseholdMembers(householdId);
  const categories = useCategories(householdId);
  const limits = useLimits(householdId);
  const summary = useBudgetSummary(householdId, window);
  const categorySpend = useCategorySpend(householdId, window);

  /*
   * Today on the household's own calendar, so a charge due tonight reads as
   * today rather than as tomorrow because UTC has not caught up.
   */
  const today = useMemo(() => localDateIn(new Date(), timeZone), [timeZone]);
  const renewalRange = useMemo(() => {
    const bounds = renewalWindow(today);
    return { from: bounds.start, to: bounds.end };
  }, [today]);
  const renewals = useUpcomingRenewals(householdId, renewalRange);

  /*
   * A subscription that has billed is money that left, so it is caught up into
   * the ledger as this screen loads — over the period on screen, cut off at
   * today. There is no scheduler in this project yet; opening the app is what
   * posts the charges, and the unique index behind it is what makes doing that
   * on every visit harmless.
   */
  const chargeWindow = useMemo(() => {
    const bounds = subscriptionChargeWindow(range, today);
    return bounds ? { from: bounds.start, to: bounds.end } : null;
  }, [range, today]);
  usePostSubscriptionCharges(householdId, chargeWindow);

  /*
   * A cancelled subscription has no next renewal, so the null is dropped
   * rather than rendered as a charge with no date.
   */
  const renewalRows = (renewals.data ?? []).flatMap((row) =>
    row.next_renewal_on
      ? [
          {
            id: row.id,
            name: row.name,
            amountMinor: row.amount_minor,
            currency: row.currency,
            renewalOn: row.next_renewal_on,
            // While a trial runs the trigger points the renewal at its end, so
            // the two dates agreeing is what says this charge is the end of a
            // free period rather than an ordinary renewal.
            trial: row.trial_ends_on === row.next_renewal_on,
          },
        ]
      : [],
  );

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

  /** What the household kept over the period: income minus spending. */
  const saved = balance;

  const described = describePeriod(range, new Date(), timeZone);

  const periodLabel =
    described.kind === 'preset'
      ? t(`period.${described.preset}`)
      : described.kind === 'month'
        ? formatMonthLabel(described.year, described.month, i18n.language)
        : t('period.custom');

  /** Converted into the reader's currency, and marked when it was converted. */
  const amount = (minor: number) =>
    formatApprox(display.convert(minor), display.currency, display.approximate);

  return (
    <View>
      {/* At the top of the screen, above everything it filters. The arrows step
          by whatever unit the period is, and are hidden for an arbitrary range,
          which has no unit to step by. */}
      <View className="p-gutter pb-0">
        <PeriodBar
          label={periodLabel}
          dates={formatRange(range, i18n.language)}
          onStep={periodUnit(range) ? (steps) => setRange(shiftPeriod(range, steps)) : undefined}
          onOpen={() => setPicking(true)}
          openLabel={t('period.change')}
          previousLabel={t('period.previousPeriod')}
          nextLabel={t('period.nextPeriod')}
        />
      </View>

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

          <View className="w-px bg-content/20" />

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

      {/* Directly under the panel, in the same family of surfaces. It answers
          the one question the panel does not name: what was kept. */}
      <View className="p-gutter pb-0">
        <SavedCard
          savedMinor={saved}
          savedLabel={amount(saved)}
          title={t('saved.title')}
          explainer={t('saved.explainer')}
        />
      </View>

      <View className="gap-gutter p-gutter">
        {/* Above the filters, because it is the one thing on this screen that
            has not happened yet: everything below is money already spent. */}
        <UpcomingRenewals rows={renewalRows} today={today} loading={renewals.isPending} />

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
                /* The rollup is the way into the expenses now that this screen
                   does not list them, so the whole row is the target. The
                   period travels with it, so the category screen opens on the
                   window the rollup was showing. */
                <Pressable
                  key={row.categoryId ?? UNCATEGORISED}
                  testID="category-row"
                  accessibilityRole="button"
                  accessibilityLabel={row.name}
                  onPress={() =>
                    router.push({
                      pathname: '/category/[categoryId]',
                      params: {
                        categoryId: row.categoryId ?? UNCATEGORISED,
                        from: range.start,
                        to: range.end,
                      },
                    })
                  }
                  className="gap-1"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className={categoryDotClass()} style={categoryDotStyle(row.color)} />
                      <Text className="text-content">{row.name}</Text>
                    </View>
                    <Text
                      testID="category-amount"
                      className={progress.exceeded ? 'text-negative' : 'text-content'}
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
                    <View className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <View
                        // Capped so an overspend does not paint outside the
                        // track; the figures above already say by how much.
                        style={{ width: `${Math.min(progress.ratio, 1) * 100}%` }}
                        className={`h-full ${progress.exceeded ? 'bg-negative' : 'bg-brand'}`}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </Card>
      </View>

      <PeriodPicker
        open={picking}
        onClose={() => setPicking(false)}
        range={range}
        timeZone={timeZone}
        onPick={setRange}
      />
    </View>
  );
}
