/**
 * Query key factory shared by web and native.
 *
 * The household id is the second segment of every key on purpose: switching
 * household — or a member being removed — invalidates everything under one
 * prefix, and there is no way to read another household's cached data.
 */

/** The period a summary covers, plus an optional author. */
export interface SummaryWindow {
  readonly from: string;
  readonly to: string;
  readonly memberId?: string;
}

export interface ExpenseListFilter {
  readonly from?: string;
  readonly to?: string;
  readonly categoryId?: string;
  readonly memberId?: string;
}

export const queryKeys = {
  // The caller's own row, not scoped by household: it is the same profile
  // whichever household it belongs to.
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  households: {
    current: (householdId: string) => ['households', householdId] as const,
    members: (householdId: string) => ['households', householdId, 'members'] as const,
  },
  categories: {
    all: (householdId: string) => ['categories', householdId] as const,
  },
  // Rates are reference data shared by every household, so this key is scoped
  // by base currency rather than by household — there is nothing in it that
  // switching household could leak.
  // Keyed by the paths themselves so the whole roster signs in one request
  // rather than one per member.
  avatars: {
    signed: (paths: string[]) => ['avatars', ...paths] as const,
  },
  currencies: {
    supported: (baseCurrency: string) => ['currencies', baseCurrency] as const,
    rate: (from: string, to: string) => ['currencies', 'rate', from, to] as const,
  },
  limits: {
    all: (householdId: string) => ['limits', householdId] as const,
  },
  subscriptions: {
    all: (householdId: string) => ['subscriptions', householdId] as const,
  },
  // The catalogue is the same for every household and only a migration
  // changes it, so this key carries no household segment.
  services: {
    all: () => ['services'] as const,
  },
  summary: {
    all: (householdId: string) => ['summary', householdId] as const,
    period: (householdId: string, window: SummaryWindow) =>
      ['summary', householdId, 'period', window] as const,
    categories: (householdId: string, window: SummaryWindow) =>
      ['summary', householdId, 'categories', window] as const,
  },
  expenses: {
    all: (householdId: string) => ['expenses', householdId] as const,
    list: (householdId: string, filter: ExpenseListFilter) =>
      ['expenses', householdId, 'list', filter] as const,
    byId: (householdId: string, expenseId: string) =>
      ['expenses', householdId, 'detail', expenseId] as const,
  },
} as const;
