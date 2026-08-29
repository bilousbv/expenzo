import { cn } from './cn';

export interface AvatarProps {
  /** The assembled display name, used for the label and the initials. */
  name: string | null | undefined;
  /** A signed URL, or null when this member has no photo. */
  url?: string | null;
  size?: AvatarSize;
  className?: string;
  testID?: string;
}

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-20 w-20',
};

const TEXT: Record<AvatarSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-2xl',
};

/** Round, unlike the square icon tile: a face is not a category. */
export function avatarClass(size: AvatarSize = 'md', extra?: string): string {
  return cn(
    'rounded-pill bg-surface-muted items-center justify-center overflow-hidden',
    SIZE[size],
    extra,
  );
}

export function avatarLabelClass(size: AvatarSize = 'md'): string {
  return cn('text-brand font-semibold', TEXT[size]);
}

/**
 * The one or two letters shown when there is no photo.
 *
 * The first and the last name rather than the first two words, so a middle
 * name does not push the surname out. `codePointAt` rather than `charAt`,
 * because a character outside the basic plane is two UTF-16 units and taking
 * the first renders half of it as a replacement glyph.
 */
export function avatarInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return '?';

  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];

  const letters = picked
    .map((word) => {
      const first = word?.codePointAt(0);
      return first === undefined ? '' : String.fromCodePoint(first).toLocaleUpperCase();
    })
    .join('');

  return letters || '?';
}
