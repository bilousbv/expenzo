'use client';

import type { ServiceRow } from '@expenzo/data';
import {
  anchorDayFor,
  billingStartsOn,
  createSubscriptionInput,
  trialEndsOn,
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
  fieldInputClass,
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
  const trialId = useId();

  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [amountKey, setAmountKey] = useState(0);

  const [chosenService, setChosenService] = useState('');
  const [name, setName] = useState('');
  const [chosenCurrency, setChosenCurrency] = useState(currency);
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [startedOn, setStartedOn] = useState(today);
  /*
   * Two pieces of state rather than one nullable number: the days keep their
   * value while the switch is off, so turning it back on does not wipe what
   * was typed. Only the switch decides what is sent.
   */
  const [onTrial, setOnTrial] = useState(false);
  const [trialDays, setTrialDays] = useState('30');
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

  const freeDays = Number(trialDays);
  const trialLength = onTrial && Number.isInteger(freeDays) && freeDays > 0 ? freeDays : undefined;

  /*
   * Billing runs from the end of the trial, not the sign-up date: a 30-day
   * trial started on 1 August bills on the 31st and monthly from there.
   * app.set_subscription_next_renewal does the same coalesce, and the two have
   * to agree or the date previewed is not the date stored.
   */
  const billingFrom = billingStartsOn(startedOn, trialLength);

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
      trialDays: trialLength,
      // Derived, never asked for twice. Somebody knows their subscription
      // started on 12 January; nobody thinks of it as "anchored on the 12th",
      // and asking for both is how the two come to disagree. With a trial it
      // is the first charge that anchors the schedule.
      anchorDay: anchorDayFor(billingFrom),
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
        className={fieldInputClass()}
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
        className={fieldInputClass()}
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
        className={fieldInputClass()}
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
        className={fieldInputClass()}
      />

      {/* Hidden until the trial is switched on: a "free days" box sitting
          empty on every subscription reads as a required field, and most
          subscriptions have no trial at all. */}
      <label className="flex flex-row items-center gap-2 text-sm text-content">
        <input
          type="checkbox"
          data-testid="subscription-trial"
          checked={onTrial}
          disabled={disabled}
          onChange={(event) => setOnTrial(event.target.checked)}
        />
        {t('subscriptions.trial')}
      </label>

      {onTrial ? (
        <>
          <label htmlFor={trialId} className="text-sm font-medium text-content-muted">
            {t('subscriptions.trialDays')}
          </label>
          <input
            id={trialId}
            name="trialDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            data-testid="subscription-trial-days"
            value={trialDays}
            onChange={(event) => setTrialDays(event.target.value)}
            className={fieldInputClass()}
          />

          {/* The date, not just the count: nobody converts "30 days from the
              12th" in their head, and that date is when money starts moving. */}
          {trialLength ? (
            <p data-testid="subscription-trial-ends" className="text-xs text-content-muted">
              {t('subscriptions.trialEnds', { date: trialEndsOn(startedOn, trialLength) })}
            </p>
          ) : null}
        </>
      ) : null}

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
        <p role="alert" data-testid="subscription-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}
