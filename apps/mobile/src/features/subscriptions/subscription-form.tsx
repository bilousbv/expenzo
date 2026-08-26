import type { ServiceRow } from '@expenzo/data';
import {
  anchorDayFor,
  createSubscriptionInput,
  subscriptionCadenceSchema,
  VALIDATION_PARAMS,
  type CreateSubscriptionInput,
  type SubscriptionCadence,
} from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  AmountField,
  Button,
  CategorySelect,
  CurrencySelect,
  type CategoryOption,
} from '@expenzo/ui';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

export interface SubscriptionFormProps {
  currency: string;
  currencies?: string[];
  services: ServiceRow[];
  categories: CategoryOption[];
  today: string;
  onCreate: (input: CreateSubscriptionInput) => Promise<void>;
  disabled?: boolean;
}

const inputClass = 'rounded-card border border-brand-100 bg-white px-4 py-3 text-content';

export function SubscriptionForm({
  currency,
  currencies,
  services,
  categories,
  today,
  onCreate,
  disabled = false,
}: SubscriptionFormProps) {
  const { t } = useTranslation();

  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [serviceId, setServiceId] = useState<string | undefined>(undefined);
  const [pickingService, setPickingService] = useState(false);
  const [name, setName] = useState('');
  const [chosenCurrency, setChosenCurrency] = useState(currency);
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [startedOn, setStartedOn] = useState(today);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const chosen = services.find((service) => service.id === serviceId);

  /**
   * Picking a service fills the name in rather than owning it. Most people
   * want "Netflix", but a household with two accounts has to be able to say
   * which is which.
   */
  function pickService(service: ServiceRow | null) {
    setPickingService(false);
    setServiceId(service?.id);
    if (service) setName(service.name);
  }

  async function handleSubmit() {
    if (pending || disabled) return;

    setError(null);

    const parsed = createSubscriptionInput.safeParse({
      serviceId,
      name,
      amountMinor,
      currency: chosenCurrency,
      cadence,
      startedOn,
      // Derived from the start date, never asked for separately.
      anchorDay: anchorDayFor(startedOn),
      categoryId,
    });

    if (!parsed.success) {
      setError(
        t(parsed.error.issues[0]?.message ?? 'subscriptions.errors.invalid', VALIDATION_PARAMS),
      );
      return;
    }

    setPending(true);
    try {
      await onCreate(parsed.data);

      setName('');
      setServiceId(undefined);
      setAmountMinor(null);
      setAmountKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('subscriptions.errors.addFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">{t('subscriptions.service')}</Text>
      {/* A Pressable opening a Modal rather than a platform picker: the
          dependency would need version-matching to the Expo SDK on every
          upgrade, and a styled list matches the rest of the app. */}
      <Pressable
        testID="subscription-service"
        accessibilityRole="button"
        accessibilityLabel={t('subscriptions.service')}
        disabled={disabled}
        onPress={() => setPickingService(true)}
        className={inputClass}
      >
        <Text className="text-content">{chosen?.name ?? t('subscriptions.serviceUnlisted')}</Text>
      </Pressable>

      <Modal
        visible={pickingService}
        animationType="slide"
        onRequestClose={() => pickService(null)}
      >
        <View className="flex-1 bg-surface p-gutter">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-content">{t('subscriptions.service')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setPickingService(false)}
            >
              <Text className="text-brand-600">{t('common.close')}</Text>
            </Pressable>
          </View>

          <ScrollView className="mt-gutter">
            <Pressable
              testID="subscription-service-none"
              accessibilityRole="button"
              onPress={() => pickService(null)}
              className="border-b border-brand-100 py-3"
            >
              <Text className="text-content">{t('subscriptions.serviceUnlisted')}</Text>
            </Pressable>

            {services.map((service) => (
              <Pressable
                key={service.id}
                testID={`subscription-service-${service.slug}`}
                accessibilityRole="button"
                onPress={() => pickService(service)}
                className="border-b border-brand-100 py-3"
              >
                <Text className="text-content">{service.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Text className="text-sm font-medium text-content-muted">{t('subscriptions.name')}</Text>
      <TextInput
        testID="subscription-name"
        value={name}
        onChangeText={setName}
        placeholder={t('subscriptions.namePlaceholder')}
        className={inputClass}
      />

      <AmountField
        key={amountKey}
        currency={chosenCurrency}
        onChange={setAmountMinor}
        disabled={disabled}
        autoFocus={false}
      />

      {currencies && currencies.length > 1 ? (
        <CurrencySelect
          currencies={currencies}
          value={chosenCurrency}
          onChange={setChosenCurrency}
          disabled={disabled}
        />
      ) : null}

      <Text className="text-sm font-medium text-content-muted">
        {t('subscriptions.billingCycle')}
      </Text>
      {/* Five short labels fit as a wrapped row, which shows every option at
          once — the same treatment the period filter gets on the dashboard. */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('subscriptions.billingCycle')}
        className="flex-row flex-wrap gap-2"
      >
        {subscriptionCadenceSchema.options.map((option) => (
          <Button
            key={option}
            testID={`cadence-${option}`}
            variant={cadence === option ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setCadence(option)}
          >
            {t(`cadence.${option}`)}
          </Button>
        ))}
      </View>

      <Text className="text-sm font-medium text-content-muted">{t('subscriptions.startedOn')}</Text>
      <TextInput
        testID="subscription-started"
        value={startedOn}
        onChangeText={setStartedOn}
        autoCapitalize="none"
        placeholder={t('expenses.datePlaceholder')}
        className={inputClass}
      />

      <CategorySelect
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        disabled={disabled}
      />

      <Button testID="subscription-submit" disabled={pending || disabled} onPress={handleSubmit}>
        {t(pending ? 'subscriptions.adding' : 'subscriptions.add')}
      </Button>

      {error ? (
        <Text testID="subscription-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
