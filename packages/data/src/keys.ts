/**
 * Query key factory shared by web and native.
 *
 * The household id is the second segment of every key on purpose: switching
 * household — or a member being removed — invalidates everything under one
 * prefix, and there is no way to read another household's cached data.
 */

export interface ExpenseListFilter {
  readonly scope?: 'all' | 'personal' | 'shared';
  readonly from?: string;
  readonly to?: string;
  readonly categoryId?: string;
  readonly memberId?: string;
}

export const queryKeys = {
  households: {
    current: (householdId: string) => ['households', householdId] as const,
    members: (householdId: string) => ['households', householdId, 'members'] as const,
  },
  categories: {
    all: (householdId: string) => ['categories', householdId] as const,
  },
  expenses: {
    all: (householdId: string) => ['expenses', householdId] as const,
    list: (householdId: string, filter: ExpenseListFilter) =>
      ['expenses', householdId, 'list', filter] as const,
    byId: (householdId: string, expenseId: string) =>
      ['expenses', householdId, 'detail', expenseId] as const,
  },
} as const;
