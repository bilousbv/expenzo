'use client';

import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useEffect, useRef, type ReactNode } from 'react';

export interface ExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Defaults to the expense dialog, which was the first thing to use this. */
  testID?: string;
  closeTestID?: string;
}

/**
 * The native `<dialog>` element rather than a hand-rolled overlay.
 *
 * `showModal()` brings focus trapping, Escape to close, inertness of the page
 * behind it and the top-layer stacking that no z-index has to fight. Every one
 * of those is easy to get subtly wrong by hand, and the ones people usually
 * miss — focus trapping and inertness — are the ones a keyboard or screen
 * reader user notices immediately.
 */
export function ExpenseDialog({
  open,
  onClose,
  title,
  children,
  testID = 'expense-dialog',
  closeTestID = 'close-expense-dialog',
}: ExpenseDialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // showModal throws if the dialog is already open, and close() on a closed
    // one is a no-op — so both sides are guarded rather than assumed.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testID}
      // Escape fires `cancel` and then `close`; listening for `close` covers
      // both that and the button, so the caller's state cannot drift out of
      // step with what is on screen.
      onClose={onClose}
      className="w-full max-w-md rounded-card border border-border bg-surface p-gutter text-content backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-gutter">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          <button
            type="button"
            data-testid={closeTestID}
            aria-label={t('common.close')}
            onClick={onClose}
            className={buttonContainerClass('ghost', 'sm')}
          >
            <span className={buttonLabelClass('ghost', 'sm')}>{t('common.close')}</span>
          </button>
        </div>

        {/* Mounted only while open, so the amount field's autoFocus fires each
            time the dialog is opened rather than once on first render. */}
        {open ? children : null}
      </div>
    </dialog>
  );
}
