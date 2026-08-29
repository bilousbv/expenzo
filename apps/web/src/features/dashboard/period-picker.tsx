'use client';

import { PERIOD_PRESETS, presetRange, type DateRange, type PeriodPreset } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useId, useState } from 'react';

import { ExpenseDialog } from '@/features/expenses/expense-dialog';

export interface PeriodPickerProps {
  open: boolean;
  onClose: () => void;
  /** The period in force, so the custom fields open on it rather than empty. */
  range: DateRange;
  timeZone: string;
  onPick: (range: DateRange) => void;
}

/**
 * Presets and a custom range, behind the period bar.
 *
 * The presets are the answer nearly every time, so they come first and apply on
 * a single tap. The two date fields underneath are the escape hatch, and they
 * need an Apply because a half-typed range would otherwise reload the dashboard
 * on every keystroke.
 */
export function PeriodPicker({ open, onClose, range, timeZone, onPick }: PeriodPickerProps) {
  const { t } = useTranslation();
  const fromId = useId();
  const toId = useId();

  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(range.end);

  /*
   * Reopened on a different period, the fields have to show that one rather
   * than whatever was typed and abandoned last time.
   *
   * Adjusted during render rather than in an effect: setting state from an
   * effect renders once with the stale value and again with the right one, and
   * the linter is right that it cascades.
   */
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setFrom(range.start);
      setTo(range.end);
    }
  }

  const reversed = from > to;

  function choosePreset(preset: PeriodPreset) {
    onPick(presetRange(preset, new Date(), timeZone));
    onClose();
  }

  function applyCustom() {
    if (reversed) return;

    onPick({ start: from, end: to });
    onClose();
  }

  return (
    <ExpenseDialog
      open={open}
      onClose={onClose}
      title={t('period.pick')}
      testID="period-dialog"
      closeTestID="close-period-dialog"
    >
      <div className="flex flex-col gap-gutter">
        <div className="flex flex-row flex-wrap gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`preset-${preset}`}
              onClick={() => choosePreset(preset)}
              className={buttonContainerClass('secondary', 'sm')}
            >
              <span className={buttonLabelClass('secondary', 'sm')}>{t(`period.${preset}`)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-row gap-gutter">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={fromId} className="text-sm font-medium text-content-muted">
              {t('period.from')}
            </label>
            <input
              id={fromId}
              data-testid="period-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={fieldInputClass()}
            />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={toId} className="text-sm font-medium text-content-muted">
              {t('period.to')}
            </label>
            <input
              id={toId}
              data-testid="period-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={fieldInputClass()}
            />
          </div>
        </div>

        {/* Refused rather than quietly swapped: a reversed range is a typo, and
            silently reinterpreting it hides which end was wrong. */}
        {reversed ? (
          <p role="alert" data-testid="period-error" className="text-sm text-negative">
            {t('period.reversed')}
          </p>
        ) : null}

        <button
          type="button"
          data-testid="period-apply"
          disabled={reversed}
          onClick={applyCustom}
          className={buttonContainerClass('primary', 'md', reversed)}
        >
          <span className={buttonLabelClass('primary', 'md')}>{t('period.apply')}</span>
        </button>
      </div>
    </ExpenseDialog>
  );
}
