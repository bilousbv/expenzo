'use client';

import {
  useCategories,
  useCreateSubscription,
  useCurrentHousehold,
  useServices,
  useSupportedCurrencies,
} from '@expenzo/data';
import { localDateIn, type CreateSubscriptionInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card, type CategoryOption } from '@expenzo/ui';

import { SubscriptionForm } from './subscription-form';
import { SubscriptionList } from './subscription-list';

export function SubscriptionManager({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();

  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';
  const timeZone = household.data?.timezone ?? 'UTC';

  const categories = useCategories(householdId);
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
  }

  return (
    <div className="flex flex-col gap-gutter">
      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('subscriptions.heading')}</h2>

        <SubscriptionForm
          currency={currency}
          currencies={currencies.data}
          services={services.data ?? []}
          categories={options}
          // Resolved in the household's timezone, like an expense date: a
          // subscription added at 23:30 in Madrid started today there.
          today={localDateIn(new Date(), timeZone)}
          onCreate={handleCreate}
          disabled={!householdId}
        />
      </Card>

      <SubscriptionList />
    </div>
  );
}
