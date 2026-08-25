'use client';

import type { CreateCategoryInput } from '@expenzo/domain';
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useCurrentHousehold,
} from '@expenzo/data';
import {
  categoryChipClass,
  categoryChipLabelClass,
  categoryDotClass,
  categoryDotStyle,
} from '@expenzo/ui';

import { CategoryForm } from './category-form';

/**
 * Wires the category screen to Supabase, so CategoryForm stays a plain
 * presentational component that tests can drive without a client.
 */
export function CategoryManager() {
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
    <div className="flex flex-col gap-gutter">
      {/* The household id scopes the insert and arrives from its own query.
          Until it lands there is nothing to insert into. */}
      <CategoryForm onCreate={handleCreate} disabled={!householdId} />

      {categories.isError ? (
        <p role="alert" className="text-sm text-red-600">
          {categories.error.message}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-content-muted">Your categories</h3>

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
                  aria-label={`Archive ${category.name}`}
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
        <h3 className="text-sm font-medium text-content-muted">Built in</h3>

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
