import {
  useCategories,
  useCreateSubscription,
  useCurrentHousehold,
  useDisplayCurrency,
  useServices,
  useSupportedCurrencies,
} from '@expenzo/data';
import { localDateIn, type CreateSubscriptionInput } from '@expenzo/domain';
import { Card, type CategoryOption } from '@expenzo/ui';
import { router } from 'expo-router';

import { useSession } from '../../features/auth/use-session';
import { FormScreen } from '../../features/layout/form-screen';
import { SubscriptionForm } from '../../features/subscriptions/subscription-form';

/**
 * Adding a subscription, presented as a modal.
 *
 * A route rather than a sheet on the list, matching expense/new: the modal
 * presentation is the navigator's business, and a route is the thing a deep
 * link can reach when the parsing in M4 starts proposing subscriptions.
 */
export default function NewSubscriptionScreen() {
  const { session } = useSession();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  // The subscription taxonomy, not the expense one: "Streaming" answers what
  // the household pays for every month, which is a different question from
  // what it spent money on last week.
  const categories = useCategories(householdId, 'subscription');
  const services = useServices();
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const display = useDisplayCurrency();
  const create = useCreateSubscription(householdId, session?.user.id);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  const timeZone = household.data?.timezone ?? 'UTC';

  async function handleCreate(input: CreateSubscriptionInput) {
    await create.mutateAsync(input);
    router.back();
  }

  return (
    <FormScreen>
      <Card className="gap-gutter">
        <SubscriptionForm
          // The currency a new subscription defaults to is the one this member
          // lives in, not the one the household reports in.
          currency={display.currency}
          currencies={currencies.data}
          services={services.data ?? []}
          categories={options}
          // Resolved in the household's timezone, like an expense date.
          today={localDateIn(new Date(), timeZone)}
          onCreate={handleCreate}
          disabled={!householdId}
        />
      </Card>
    </FormScreen>
  );
}
