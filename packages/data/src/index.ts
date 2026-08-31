export { SupabaseProvider, useSupabase } from './provider';
export type { SupabaseProviderProps } from './provider';

export { queryKeys } from './keys';
export type { ExpenseListFilter, SummaryWindow } from './keys';

export { createLimit, deleteLimit, listLimits, updateLimit } from './repositories/limits';
export type { SpendingLimitRow } from './repositories/limits';
export {
  cancelSubscription,
  createSubscription,
  deleteSubscription,
  listServices,
  listSubscriptions,
  listUpcomingRenewals,
  postSubscriptionCharges,
  updateSubscription,
} from './repositories/subscriptions';
export type { RenewalWindow, ServiceRow, SubscriptionRow } from './repositories/subscriptions';

export { listSupportedCurrencies, upsertEcbRates, upsertEurRates } from './repositories/fx';
export type { FxSyncResult } from './repositories/fx';

export { useSupportedCurrencies } from './hooks/use-currencies';

export { getCategorySpend, getPeriodSummary } from './repositories/summary';
export type { CategorySpend, PeriodSummary, SummaryArgs } from './repositories/summary';

export { useCreateLimit, useDeleteLimit, useLimits, useUpdateLimit } from './hooks/use-limits';
export {
  useCancelSubscription,
  useCreateSubscription,
  useDeleteSubscription,
  usePostSubscriptionCharges,
  useServices,
  useSubscriptions,
  useUpcomingRenewals,
  useUpdateSubscription,
} from './hooks/use-subscriptions';
export { useBudgetSummary, useCategorySpend, usePeriodSummary } from './hooks/use-summary';

export {
  deliverNotifications,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from './repositories/notifications';
export type { NotificationPreferenceRow, NotificationRow } from './repositories/notifications';

export {
  useDeliverNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useSetNotificationPreference,
} from './hooks/use-notifications';
export type { BudgetSummaryResult } from './hooks/use-summary';

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

export {
  acceptInvitation,
  listPendingInvitations,
  previewInvitation,
  revokeInvitation,
  sendInvitation,
} from './repositories/invitations';
export type { InvitationPreview, InvitationRow } from './repositories/invitations';

export { removeMember, setMemberRole } from './repositories/members';

export { useInvitations, useRevokeInvitation, useSendInvitation } from './hooks/use-invitations';
export type { SendInvitationArgs } from './hooks/use-invitations';

export { listHouseholdMembers } from './repositories/profiles';
export type { HouseholdMember } from './repositories/profiles';

export { useHouseholdMembers, useRemoveMember, useSetMemberRole } from './hooks/use-members';

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

export { displayCurrencyFrom } from './display-currency';
export type { DisplayCurrency } from './display-currency';

export { getDisplayRate } from './repositories/fx';
export { getMyProfile, updateMyProfile } from './repositories/profiles';
export type { ProfileRow } from './repositories/profiles';
export { useDisplayCurrency, useMyProfile, useUpdateMyProfile } from './hooks/use-profile';

export { clearMyAvatar, setMyAvatar, signedAvatarUrls } from './repositories/avatars';
export type { AvatarUpload } from './repositories/avatars';
export {
  useAvatarUrls,
  useClearMyAvatar,
  useMyAvatarUrl,
  useSetMyAvatar,
} from './hooks/use-avatars';
