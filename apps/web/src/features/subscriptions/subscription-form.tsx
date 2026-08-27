'use client';

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
  buttonContainerClass,
  buttonLabelClass,
  CategorySelect,
  CurrencySelect,
  type CategoryOption,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export interface SubscriptionFormProps {
  currency: string;
  currencies?: string[];
  services: ServiceRow[];
  categories: CategoryOption[];
  /** Today in the household timezone, resolved by the caller. */
  today: string;
  onCreate: (input: CreateSubscriptionInput) => Promise<void>;
  disabled?: boolean;
}

const inputClass =
  'rounded-card border border-brand-100 bg-white px-4 py-3 text-content outline-none focus:border-brand-500';

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
  const serviceId = useId();
  const nameId = useId();
  const cadenceId = useId();
  const startedId = useId();

  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [chosenService, setChosenService] = useState('');
  const [name, setName] = useState('');
  const [chosenCurrency, setChosenCurrency] = useState(currency);
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [startedOn, setStartedOn] = useState(today);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * Picking a service fills the name in rather than replacing the field. Most
   * people want "Netflix", but a household with two of them needs to be able to
   * say which — and a name that cannot be edited makes that impossible.
   */
  function handleServiceChange(value: string) {
    setChosenService(value);

    const service = services.find((candidate) => candidate.id === value);
    if (service) setName(service.name);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (pending || disabled) return;

    setError(null);

    const parsed = createSubscriptionInput.safeParse({
      serviceId: chosenService || undefined,
      name,
      amountMinor,
      currency: chosenCurrency,
      cadence,
      startedOn,
      // Derived, never asked for twice. Somebody knows their subscription
      // started on 12 January; nobody thinks of it as "anchored on the 12th",
      // and asking for both is how the two come to disagree.
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
      setChosenService('');
      setAmountMinor(null);
      setAmountKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('subscriptions.errors.addFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={serviceId} className="text-sm font-medium text-content-muted">
        {t('subscriptions.service')}
      </label>
      <select
        id={serviceId}
        data-testid="subscription-service"
        value={chosenService}
        disabled={disabled}
        onChange={(event) => handleServiceChange(event.target.value)}
        className={inputClass}
      >
        {/* Most subscriptions are not in any catalogue, so "not listed" is the
            starting position rather than an afterthought at the bottom. */}
        <option value="">{t('subscriptions.serviceUnlisted')}</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>

      <label htmlFor={nameId} className="text-sm font-medium text-content-muted">
        {t('subscriptions.name')}
      </label>
      <input
        id={nameId}
        name="name"
        data-testid="subscription-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('subscriptions.namePlaceholder')}
        className={inputClass}
      />

      <AmountField
        key={amountKey}
        currency={chosenCurrency}
        onChange={setAmountMinor}
        disabled={disabled}
      />

      {currencies && currencies.length > 1 ? (
        <CurrencySelect
          currencies={currencies}
          value={chosenCurrency}
          onChange={setChosenCurrency}
          disabled={disabled}
        />
      ) : null}

      <label htmlFor={cadenceId} className="text-sm font-medium text-content-muted">
        {t('subscriptions.billingCycle')}
      </label>
      <select
        id={cadenceId}
        data-testid="subscription-cadence"
        value={cadence}
        disabled={disabled}
        onChange={(event) => setCadence(event.target.value as SubscriptionCadence)}
        className={inputClass}
      >
        {subscriptionCadenceSchema.options.map((option) => (
          <option key={option} value={option}>
            {t(`cadence.${option}`)}
          </option>
        ))}
      </select>

      <label htmlFor={startedId} className="text-sm font-medium text-content-muted">
        {t('subscriptions.startedOn')}
      </label>
      <input
        id={startedId}
        name="startedOn"
        type="date"
        data-testid="subscription-started"
        value={startedOn}
        onChange={(event) => setStartedOn(event.target.value)}
        className={inputClass}
      />

      <CategorySelect
        options={categories}
        value={categoryId}
        onChange={setCategoryId}
        disabled={disabled}
      />

      <button
        type="submit"
        data-testid="subscription-submit"
        disabled={pending || disabled}
        className={buttonContainerClass('primary', 'md', pending || disabled)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'subscriptions.adding' : 'subscriptions.add')}
        </span>
      </button>

      {error ? (
        <p role="alert" data-testid="subscription-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
