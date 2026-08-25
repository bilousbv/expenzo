export { SupabaseProvider, useSupabase } from './provider';
export type { SupabaseProviderProps } from './provider';

export { queryKeys } from './keys';
export type { ExpenseListFilter, SummaryWindow } from './keys';

export { createLimit, deleteLimit, listLimits, updateLimit } from './repositories/limits';
export type { SpendingLimitRow } from './repositories/limits';

export { getCategorySpend, getPeriodSummary } from './repositories/summary';
export type { CategorySpend, PeriodSummary, SummaryArgs } from './repositories/summary';

export { useCreateLimit, useDeleteLimit, useLimits, useUpdateLimit } from './hooks/use-limits';
export { useCategorySpend, usePeriodSummary } from './hooks/use-summary';

export {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
} from './repositories/categories';
export type { CategoryRow } from './repositories/categories';

export {
  createExpense,
  deleteExpense,
  listExpenses,
  DEFAULT_PAGE_SIZE,
} from './repositories/expenses';
export type { ExpenseCursor, ExpensePage, ExpenseRow } from './repositories/expenses';

export { useCreateExpense, useDeleteExpense, useExpenses } from './hooks/use-expenses';
export type { UseExpensesOptions } from './hooks/use-expenses';

export { listHouseholdMembers } from './repositories/profiles';
export type { HouseholdMember } from './repositories/profiles';

export { useHouseholdMembers } from './hooks/use-members';

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
