import { createCategoryInput, VALIDATION_PARAMS, type CreateCategoryInput } from '@expenzo/domain';
import { Button, categoryDotStyle, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
import { Pressable, Text, TextInput, View } from 'react-native';

/** Named because a colour needs an accessible name; the hex is not one. */
const PALETTE = [
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
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0].hex);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    // A fast double tap lands two presses before the re-render, and the second
    // category then loses the unique index for reasons the user cannot see.
    // The household check is the same idea one layer up: the insert is scoped
    // by an id that arrives from its own query, and submitting before it lands
    // used to surface as "No household is loaded yet".
    if (pending || disabled) return;

    setError(null);

    // The same schema the repository validates against, so the phone and the
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
      // Deliberately not clearing the field: retyping the name is not part of
      // the fix for whatever went wrong.
      setError(cause instanceof Error ? cause.message : t('categories.errors.addFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">{t('categories.name')}</Text>

      <TextInput
        testID="category-name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder={t('categories.namePlaceholder')}
        className={fieldInputClass()}
      />

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('categories.colour')}
        className="flex-row gap-2"
      >
        {PALETTE.map((swatch) => (
          <Pressable
            key={swatch.hex}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === swatch.hex }}
            accessibilityLabel={t(`categories.colours.${swatch.key}`)}
            testID={`category-color-${swatch.hex}`}
            onPress={() => setColor(swatch.hex)}
            style={categoryDotStyle(swatch.hex)}
            className={`h-8 w-8 rounded-full border-2 ${
              color === swatch.hex ? 'border-content' : 'border-transparent'
            }`}
          />
        ))}
      </View>

      <Button testID="category-submit" disabled={pending || disabled} onPress={handleSubmit}>
        {t(pending ? 'categories.adding' : 'categories.add')}
      </Button>

      {error ? (
        <Text testID="category-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
