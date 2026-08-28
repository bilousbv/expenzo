import { FormScreen } from '../features/layout/form-screen';
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useCurrentHousehold,
} from '@expenzo/data';
import type { CreateCategoryInput } from '@expenzo/domain';
import {
  Card,
  categoryChipClass,
  categoryChipLabelClass,
  categoryDotClass,
  categoryDotStyle,
} from '@expenzo/ui';
import { useTranslation } from '@expenzo/i18n';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CategoryForm } from '../features/categories/category-form';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  const categories = useCategories(householdId);
  const create = useCreateCategory(householdId);
  const archive = useArchiveCategory(householdId);

  async function handleCreate(input: CreateCategoryInput) {
    await create.mutateAsync(input);
  }

  const rows = categories.data ?? [];
  const custom = rows.filter((category) => !category.is_system);
  const system = rows.filter((category) => category.is_system);

  return (
    <FormScreen>
      <Card className="gap-gutter">
        {/* The household id scopes the insert and arrives from its own
              query. Until it lands there is nothing to insert into. */}
        <CategoryForm onCreate={handleCreate} disabled={!householdId} />
      </Card>

      <Card className="gap-gutter">
        <Text className="text-lg font-semibold text-content">Your categories</Text>

        {categories.isPending ? (
          <ActivityIndicator />
        ) : custom.length === 0 ? (
          <Text testID="no-custom-categories" className="text-sm text-content-muted">
            None yet. The built-in categories below cover most spending.
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {custom.map((category) => (
              <View key={category.id} className={categoryChipClass(false)}>
                <View className={categoryDotClass()} style={categoryDotStyle(category.color)} />
                <Text testID="custom-category" className={categoryChipLabelClass(false)}>
                  {category.name}
                </Text>
                {/* Archives rather than deletes: expenses.category_id is
                      `on delete set null`, so deleting would quietly
                      uncategorise every expense that ever used it. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('categories.archiveLabel', { name: category.name })}
                  disabled={archive.isPending}
                  onPress={() => archive.mutate(category.id)}
                >
                  <Text className="text-sm text-content-muted">×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card className="gap-gutter">
        <Text className="text-lg font-semibold text-content">Built in</Text>

        <View className="flex-row flex-wrap gap-2">
          {system.map((category) => (
            <View key={category.id} className={categoryChipClass(false)}>
              <View className={categoryDotClass()} style={categoryDotStyle(category.color)} />
              <Text testID="system-category" className={categoryChipLabelClass(false)}>
                {category.name}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </FormScreen>
  );
}
