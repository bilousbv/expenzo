import { FormScreen } from '../features/layout/form-screen';
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useCurrentHousehold,
} from '@expenzo/data';
import { categoryKindSchema, type CategoryKind, type CreateCategoryInput } from '@expenzo/domain';
import {
  Button,
  Card,
  categoryChipClass,
  categoryChipLabelClass,
  categoryDotClass,
  categoryDotStyle,
} from '@expenzo/ui';
import { useTranslation } from '@expenzo/i18n';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CategoryForm } from '../features/categories/category-form';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  /*
   * Two taxonomies on one screen rather than two screens. They are the same
   * job — naming the buckets — and a household that has just filed a
   * subscription under the wrong one wants the other list a tap away.
   */
  const [kind, setKind] = useState<CategoryKind>('expense');

  const categories = useCategories(householdId, kind);
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
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('categories.title')}
          className="flex-row gap-2"
        >
          {categoryKindSchema.options.map((option) => (
            <Button
              key={option}
              testID={`kind-${option}`}
              variant={kind === option ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setKind(option)}
            >
              {t(option === 'expense' ? 'categories.expenseKind' : 'categories.subscriptionKind')}
            </Button>
          ))}
        </View>

        {/* The household id scopes the insert and arrives from its own
              query. Until it lands there is nothing to insert into. The kind
              travels with it, so a category added from this tab joins that
              list and no other. */}
        <CategoryForm onCreate={handleCreate} kind={kind} disabled={!householdId} />
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
