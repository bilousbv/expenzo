import {
  savedAmountClass,
  savedCardClass,
  savedExplainerClass,
  savedGlyph,
  savedIconClass,
  savedIconGlyphClass,
  savedTitleClass,
  type SavedCardProps,
} from './saved-card.styles';

/**
 * What the household put aside over the period: income minus spending.
 *
 * Web implementation. Metro picks `saved-card.native.tsx` instead.
 *
 * Sits directly under the balance panel and reads as one line rather than a
 * grid — it answers a single question, and giving it the shape of a summary
 * would make it compete with the panel above.
 */
export function SavedCard({
  savedMinor,
  savedLabel,
  title,
  explainer,
  className,
  testID = 'saved-card',
}: SavedCardProps) {
  return (
    <div data-testid={testID} className={savedCardClass(`flex ${className ?? ''}`)}>
      <span aria-hidden className={`flex ${savedIconClass}`}>
        <span className={savedIconGlyphClass}>=</span>
      </span>

      <span className="flex flex-1 flex-col">
        <span className={savedTitleClass}>{title}</span>
        <span className={savedExplainerClass}>{explainer}</span>
      </span>

      <span data-testid="saved-amount" className={savedAmountClass(savedMinor)}>
        {savedGlyph(savedMinor)} {savedLabel}
      </span>
    </div>
  );
}
