import type { ReactNode } from 'react';

import { cn } from './cn';

export interface IconTileProps {
  children?: ReactNode;
  /** The category colour this tile is tinted with, or null for the neutral one. */
  color?: string | null;
  className?: string;
  testID?: string;
}

/** Rounded square, matching the reference's transaction rows. */
export function iconTileClass(extra?: string): string {
  return cn('rounded-tile h-11 w-11 items-center justify-center', extra);
}

/**
 * A wash of the category colour rather than the colour itself.
 *
 * A saturated tile at this size fights the amount for attention, and the row's
 * subject is the merchant and the figure — the tile is only a way of telling
 * one row from another at a glance. Hex plus an alpha suffix rather than an
 * `rgba()` string, because React Native's style parser accepts #RRGGBBAA and
 * this way both platforms take the identical value.
 */
export function iconTileStyle(color?: string | null): { backgroundColor: string } {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6b7280';

  return { backgroundColor: `${base}22` };
}

/** The glyph colour, kept at full strength so it reads against the wash. */
export function iconTileGlyphStyle(color?: string | null): { color: string } {
  const base = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6b7280';

  return { color: base };
}

/**
 * The single character a tile shows when there is no logo to show.
 *
 * The reference puts a merchant's mark here; we have none, and an empty tinted
 * square reads as something that failed to load. A monogram is honest about
 * being derived from the name, and still gives the eye something to tell one
 * row from another by.
 *
 * `codePointAt` rather than `charAt`: an emoji or any character outside the
 * basic plane is two UTF-16 units, and taking the first would render half of
 * it as a replacement glyph.
 */
export function monogramFor(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '?';

  const first = trimmed.codePointAt(0);
  if (first === undefined) return '?';

  return String.fromCodePoint(first).toLocaleUpperCase();
}

export const iconTileGlyphClass = 'text-base font-semibold';
