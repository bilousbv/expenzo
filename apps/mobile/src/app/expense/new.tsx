import {
  useCategories,
  useCreateExpense,
  useCurrentHousehold,
  useDisplayCurrency,
  useSupportedCurrencies,
} from '@expenzo/data';
import { localDateIn, type CreateExpenseInput } from '@expenzo/domain';
import { Card, type CategoryOption } from '@expenzo/ui';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../features/auth/use-session';
import { ExpenseForm } from '../../features/expenses/expense-form';

/**
 * Its own route rather than a sheet on the list.
 *
 * M6 deep-links here from a wallet payment — `expenzo://expense/new` — where
 * the amount is the only thing left for the user to type, which is why the
 * amount field takes focus on mount. That makes M6 a routing change only.
 */
export default function NewExpenseScreen() {
  const { session } = useSession();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  const categories = useCategories(householdId);
  const create = useCreateExpense(householdId, session?.user.id);
  // Held for a day: rates change daily, the set of quoted currencies does not.
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const display = useDisplayCurrency();

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  const timeZone = household.data?.timezone ?? 'UTC';

  async function handleCreate(input: CreateExpenseInput) {
    await create.mutateAsync(input);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="p-gutter">
        <Card className="gap-gutter">
          <ExpenseForm
            // The currency a new expense defaults to is the one this member
            // lives in, not the one the household reports in.
            currency={display.currency}
            today={localDateIn(new Date(), timeZone)}
            categories={options}
            currencies={currencies.data}
            onCreate={handleCreate}
            disabled={!householdId}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
