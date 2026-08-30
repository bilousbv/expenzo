'use client';

import {
  useCategories,
  useCreateSubscription,
  useCurrentHousehold,
  useDisplayCurrency,
  useServices,
  useSupportedCurrencies,
} from '@expenzo/data';
import { localDateIn, type CreateSubscriptionInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, type CategoryOption } from '@expenzo/ui';
import { useState } from 'react';

import { FormDialog } from '@/features/layout/form-dialog';

import { SubscriptionForm } from './subscription-form';
import { SubscriptionList } from './subscription-list';

export function SubscriptionManager({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();

  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  // The currency a new subscription defaults to is the one this member lives
  // in, not the one the household reports in. The picker still offers the rest.
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const [adding, setAdding] = useState(false);

  // The subscription taxonomy, not the expense one: "Streaming" answers what
  // the household pays for every month, which is a different question from
  // what it spent money on last week.
  const categories = useCategories(householdId, 'subscription');
  const services = useServices();
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const create = useCreateSubscription(householdId, userId);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  async function handleCreate(input: CreateSubscriptionInput) {
    await create.mutateAsync(input);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-gutter">
      {/* A dialog rather than a form standing permanently above the list.
          Adding a subscription happens a handful of times a year; reading what
          the household already pays for is what the screen is for the rest of
          the time. */}
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold text-content">{t('subscriptions.heading')}</h2>
        <button
          type="button"
          data-testid="open-subscription-dialog"
          disabled={!householdId}
          onClick={() => setAdding(true)}
          className={buttonContainerClass('primary', 'md', !householdId)}
        >
          <span className={buttonLabelClass('primary', 'md')}>{t('subscriptions.add')}</span>
        </button>
      </div>

      <SubscriptionList />

      <FormDialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('subscriptions.addDialogTitle')}
        testID="subscription-dialog"
        closeTestID="close-subscription-dialog"
      >
        <SubscriptionForm
          currency={display.currency}
          currencies={currencies.data}
          services={services.data ?? []}
          categories={options}
          // Resolved in the household's timezone, like an expense date: a
          // subscription added at 23:30 in Madrid started today there.
          today={localDateIn(new Date(), timeZone)}
          onCreate={handleCreate}
          disabled={!householdId}
        />
      </FormDialog>
    </div>
  );
}
