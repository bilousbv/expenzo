import {
  periodArrowClass,
  periodArrowGlyphClass,
  periodArrowSpacerClass,
  periodBarClass,
  periodCentreClass,
  periodDatesClass,
  periodLabelClass,
  type PeriodBarProps,
} from './period-bar.styles';

/**
 * Web implementation. Metro picks `period-bar.native.tsx` instead.
 *
 * The arrows step whole months and are shown only while the period is one. The
 * centre opens the picker, and carries both the name and the exact dates —
 * the name alone cannot say where a stepped month actually starts.
 */
export function PeriodBar({
  label,
  dates,
  onStep,
  onOpen,
  openLabel,
  previousLabel,
  nextLabel,
  className,
  testID = 'period-bar',
}: PeriodBarProps) {
  return (
    <div data-testid={testID} className={periodBarClass(`flex ${className ?? ''}`)}>
      {onStep ? (
        <button
          type="button"
          data-testid="period-previous"
          aria-label={previousLabel}
          onClick={() => onStep(-1)}
          className={`flex ${periodArrowClass}`}
        >
          <span className={periodArrowGlyphClass}>‹</span>
        </button>
      ) : (
        // Holds the space so the label does not jump sideways when a custom
        // range hides the arrows.
        <span aria-hidden className={periodArrowSpacerClass} />
      )}

      <button
        type="button"
        data-testid="period-open"
        aria-label={openLabel}
        onClick={onOpen}
        className={`flex flex-col ${periodCentreClass}`}
      >
        <span data-testid="period-label" className={periodLabelClass}>
          {label}
        </span>
        <span data-testid="period-dates" className={periodDatesClass}>
          {dates}
        </span>
      </button>

      {onStep ? (
        <button
          type="button"
          data-testid="period-next"
          aria-label={nextLabel}
          onClick={() => onStep(1)}
          className={`flex ${periodArrowClass}`}
        >
          <span className={periodArrowGlyphClass}>›</span>
        </button>
      ) : (
        <span aria-hidden className={periodArrowSpacerClass} />
      )}
    </div>
  );
}
