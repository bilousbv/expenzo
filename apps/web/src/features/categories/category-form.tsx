'use client';

import { createCategoryInput, VALIDATION_PARAMS, type CreateCategoryInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  categoryDotStyle,
  fieldInputClass,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

/** Named because a colour needs an accessible name; the hex is not one. */
export const PALETTE = [
  { key: 'blue', hex: '#337dff' },
  { key: 'orange', hex: '#f97316' },
  { key: 'teal', hex: '#14b8a6' },
  { key: 'purple', hex: '#8b5cf6' },
  { key: 'pink', hex: '#ec4899' },
  { key: 'green', hex: '#22c55e' },
  { key: 'red', hex: '#ef4444' },
  { key: 'slate', hex: '#64748b' },
] as const;

export interface CategoryFormProps {
  onCreate: (input: CreateCategoryInput) => Promise<void>;
  /** Set while the household this category would belong to is still loading. */
  disabled?: boolean;
}

export function CategoryForm({ onCreate, disabled = false }: CategoryFormProps) {
  const nameId = useId();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0].hex);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Guarding here as well as with the attribute: a second submit landing
    // before the re-render creates two categories, and one of them then loses
    // the unique index for reasons the user cannot see. The household check is
    // the same idea one layer up — the insert is scoped by an id that arrives
    // from its own query, and submitting before it lands used to surface as
    // "No household is loaded yet".
    if (pending || disabled) return;

    setError(null);

    // The same schema the repository validates against, so the browser and the
    // database agree on what a category is.
    const parsed = createCategoryInput.safeParse({ name, color });

    if (!parsed.success) {
      setError(
        t(parsed.error.issues[0]?.message ?? 'categories.errors.invalid', VALIDATION_PARAMS),
      );
      return;
    }

    setPending(true);
    try {
      await onCreate(parsed.data);
      setName('');
    } catch (cause) {
      // Deliberately not clearing the field: whatever went wrong, retyping the
      // name is not part of the fix.
      setError(cause instanceof Error ? cause.message : t('categories.errors.addFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={nameId} className="text-sm font-medium text-content-muted">
        {t('categories.name')}
      </label>

      <input
        id={nameId}
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-invalid={error ? true : undefined}
        placeholder={t('categories.namePlaceholder')}
        className={fieldInputClass()}
      />

      <div
        role="radiogroup"
        aria-label={t('categories.colour')}
        className="flex flex-row flex-wrap gap-2"
      >
        {PALETTE.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            role="radio"
            aria-checked={color === swatch.hex}
            aria-label={t(`categories.colours.${swatch.key}`)}
            onClick={() => setColor(swatch.hex)}
            style={categoryDotStyle(swatch.hex)}
            className={`h-8 w-8 rounded-full border-2 ${
              color === swatch.hex ? 'border-content' : 'border-transparent'
            }`}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={pending || disabled}
        className={buttonContainerClass('primary', 'md', pending || disabled)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'categories.adding' : 'categories.add')}
        </span>
      </button>

      {error ? (
        <p role="alert" data-testid="category-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}
