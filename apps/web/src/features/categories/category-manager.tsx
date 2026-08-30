'use client';

import { categoryKindSchema, type CategoryKind, type CreateCategoryInput } from '@expenzo/domain';
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useCurrentHousehold,
} from '@expenzo/data';
import {
  buttonContainerClass,
  buttonLabelClass,
  categoryChipClass,
  categoryChipLabelClass,
  categoryDotClass,
  categoryDotStyle,
} from '@expenzo/ui';
import { useState } from 'react';

import { useTranslation } from '@expenzo/i18n';

import { CategoryForm } from './category-form';

/**
 * Wires the category screen to Supabase, so CategoryForm stays a plain
 * presentational component that tests can drive without a client.
 */
export function CategoryManager() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  /*
   * Two taxonomies on one screen rather than two screens. They are the same
   * job — naming the buckets — and a household that has just filed a
   * subscription under the wrong one wants the other list a click away.
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
    <div className="flex flex-col gap-gutter">
      <div role="radiogroup" aria-label={t('categories.title')} className="flex flex-row gap-2">
        {categoryKindSchema.options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            data-testid={`kind-${option}`}
            onClick={() => setKind(option)}
            className={buttonContainerClass(kind === option ? 'primary' : 'secondary', 'sm')}
          >
            <span className={buttonLabelClass(kind === option ? 'primary' : 'secondary', 'sm')}>
              {t(option === 'expense' ? 'categories.expenseKind' : 'categories.subscriptionKind')}
            </span>
          </button>
        ))}
      </div>

      {/* The household id scopes the insert and arrives from its own query.
          Until it lands there is nothing to insert into. The kind travels with
          it, so a category added from this tab joins that list and no other. */}
      <CategoryForm onCreate={handleCreate} kind={kind} disabled={!householdId} />

      {categories.isError ? (
        <p role="alert" className="text-sm text-negative">
          {categories.error.message}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-content-muted">{t('categories.yours')}</h3>

        {custom.length === 0 ? (
          <p data-testid="no-custom-categories" className="text-sm text-content-muted">
            None yet. The system categories below cover most spending.
          </p>
        ) : (
          <ul className="flex flex-row flex-wrap gap-2">
            {custom.map((category) => (
              <li key={category.id} className={categoryChipClass(false)}>
                <span
                  aria-hidden
                  className={categoryDotClass()}
                  style={categoryDotStyle(category.color)}
                />
                <span data-testid="custom-category" className={categoryChipLabelClass(false)}>
                  {category.name}
                </span>
                {/* Archives rather than deletes: expenses.category_id is
                    `on delete set null`, so deleting would quietly
                    uncategorise every expense that ever used it. */}
                <button
                  type="button"
                  aria-label={t('categories.archiveLabel', { name: category.name })}
                  disabled={archive.isPending}
                  onClick={() => archive.mutate(category.id)}
                  className="text-sm text-content-muted"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-content-muted">{t('categories.builtIn')}</h3>

        <ul className="flex flex-row flex-wrap gap-2">
          {system.map((category) => (
            <li key={category.id} className={categoryChipClass(false)}>
              <span
                aria-hidden
                className={categoryDotClass()}
                style={categoryDotStyle(category.color)}
              />
              <span data-testid="system-category" className={categoryChipLabelClass(false)}>
                {category.name}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
