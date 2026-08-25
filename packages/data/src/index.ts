export { SupabaseProvider, useSupabase } from './provider';
export type { SupabaseProviderProps } from './provider';

export { queryKeys } from './keys';
export type { ExpenseListFilter } from './keys';

export {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
} from './repositories/categories';
export type { CategoryRow } from './repositories/categories';

export { getCurrentHousehold } from './repositories/households';
export type { HouseholdRow } from './repositories/households';

export {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from './hooks/use-categories';
export { useCurrentHousehold } from './hooks/use-household';

export type { Database, Db } from './types';
