export interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
  /**
   * A lucide icon name carried straight from the row. Nothing renders it yet —
   * neither app has an icon set wired up — but it travels with the option so
   * the picker's shape does not have to change when one arrives.
   */
  icon: string | null;
}

export interface CategoryPickerProps {
  options: CategoryOption[];
  /** The selected category id, or undefined for "no category". */
  value?: string;
  /** Called with the new id, or undefined when the selection is cleared. */
  onChange: (id: string | undefined) => void;
  /** Accessible name for the group. */
  label?: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
}

export function categoryPickerClass(): string {
  return 'flex-row flex-wrap gap-2';
}

export function categoryPickerEmptyClass(): string {
  return 'text-content-muted text-sm';
}
