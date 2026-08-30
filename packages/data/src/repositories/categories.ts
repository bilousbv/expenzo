import {
  createCategoryInput,
  type CategoryKind,
  slugify,
  updateCategoryInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@expenzo/domain';

import type { Database, Db } from '../types';

type Row = Database['public']['Tables']['categories']['Row'];

/**
 * The columns every category screen reads. Picked from the generated Row rather
 * than restated, so a dropped column fails the type check instead of arriving
 * as undefined at runtime.
 */
export type CategoryRow = Pick<
  Row,
  | 'id'
  | 'household_id'
  | 'slug'
  | 'name'
  | 'icon'
  | 'color'
  | 'parent_id'
  | 'is_system'
  | 'sort_order'
  | 'archived_at'
  | 'kind'
>;

const COLUMNS =
  'id, household_id, slug, name, icon, color, parent_id, is_system, sort_order, archived_at, kind';

/** Postgres' unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * System categories and the caller's own, in display order.
 *
 * No household filter: the select policy already limits this to system rows
 * plus the caller's household, and a filter here could only narrow that
 * further. Filtering on household_id would in fact drop every system category,
 * because theirs is null.
 *
 * One kind at a time, defaulting to expenses: a picker asks about one
 * taxonomy, and every caller that predates the split means that one.
 */
export async function listCategories(
  db: Db,
  kind: CategoryKind = 'expense',
): Promise<CategoryRow[]> {
  const { data, error } = await db
    .from('categories')
    .select(COLUMNS)
    .eq('kind', kind)
    .is('archived_at', null)
    .order('sort_order')
    .order('name');

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function createCategory(
  db: Db,
  householdId: string,
  input: CreateCategoryInput,
): Promise<CategoryRow> {
  const parsed = createCategoryInput.parse(input);

  const { data, error } = await db
    .from('categories')
    .insert({
      // Named explicitly because the write policy's WITH CHECK compares it and
      // the column has no default. is_system is generated from it.
      household_id: householdId,
      kind: parsed.kind,
      slug: slugify(parsed.name),
      name: parsed.name,
      icon: parsed.icon ?? null,
      color: parsed.color ?? null,
      parent_id: parsed.parentId ?? null,
      sort_order: parsed.sortOrder,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // Two members adding "Coffee" at the same moment both pass validation and
    // one loses the index. The constraint name is not something the user can
    // act on; the name they typed is.
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A category called ${parsed.name} already exists in this household.`);
    }

    throw new Error(error.message);
  }

  return data;
}

export async function updateCategory(db: Db, input: UpdateCategoryInput): Promise<CategoryRow> {
  const { id, ...rest } = updateCategoryInput.parse(input);

  const patch: Database['public']['Tables']['categories']['Update'] = {};
  if ('name' in rest) patch.name = rest.name;
  if ('icon' in rest) patch.icon = rest.icon ?? null;
  if ('color' in rest) patch.color = rest.color ?? null;
  if ('parentId' in rest) patch.parent_id = rest.parentId ?? null;
  if ('sortOrder' in rest) patch.sort_order = rest.sortOrder;

  // An empty patch is a no-op update that still fires the RLS check and the
  // audit trail. Refusing it makes the caller's mistake visible.
  if (Object.keys(patch).length === 0) {
    throw new Error('Nothing to update.');
  }

  const { data, error } = await db
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A category called ${patch.name} already exists in this household.`);
    }

    throw new Error(error.message);
  }

  return data;
}

/**
 * Archive rather than delete.
 *
 * expenses.category_id is `on delete set null`, so deleting a category silently
 * uncategorises every expense that ever used it. Archiving takes it out of the
 * picker and leaves history attributed.
 */
export async function archiveCategory(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
