import { createCategoryInput, type CreateCategoryInput } from '@expenzo/domain';
import { Button, categoryDotStyle } from '@expenzo/ui';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

/** Named because a colour needs an accessible name; the hex is not one. */
const PALETTE = [
  { name: 'Blue', hex: '#337dff' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Slate', hex: '#64748b' },
] as const;

export interface CategoryFormProps {
  onCreate: (input: CreateCategoryInput) => Promise<void>;
  /** Set while the household this category would belong to is still loading. */
  disabled?: boolean;
}

export function CategoryForm({ onCreate, disabled = false }: CategoryFormProps) {
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
      setError(parsed.error.issues[0]?.message ?? 'That category is not valid.');
      return;
    }

    setPending(true);
    try {
      await onCreate(parsed.data);
      setName('');
    } catch (cause) {
      // Deliberately not clearing the field: retyping the name is not part of
      // the fix for whatever went wrong.
      setError(cause instanceof Error ? cause.message : 'Could not add the category.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">Name</Text>

      <TextInput
        testID="category-name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Coffee"
        className="rounded-card border border-brand-100 bg-white px-4 py-3 text-content"
      />

      <View accessibilityRole="radiogroup" accessibilityLabel="Colour" className="flex-row gap-2">
        {PALETTE.map((swatch) => (
          <Pressable
            key={swatch.hex}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === swatch.hex }}
            accessibilityLabel={swatch.name}
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
        {pending ? 'Adding…' : 'Add category'}
      </Button>

      {error ? (
        <Text testID="category-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
