'use client';

import type { AvatarUpload } from '@expenzo/data';
import { avatarFileProblem, AVATAR_MIME_TYPES } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Avatar, buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useId, useRef, useState, type ChangeEvent } from 'react';

export interface AvatarFieldProps {
  /** The assembled display name, for the label and the initials fallback. */
  name: string | null | undefined;
  /** A signed URL, or null when there is no photo yet. */
  url: string | null;
  onChoose: (file: AvatarUpload) => Promise<void>;
  onRemove: () => Promise<void>;
}

/**
 * The photo on the profile screen.
 *
 * The file is checked here as well as by the repository and by the bucket. The
 * bucket's refusal is the one that matters — it is the half a client cannot
 * talk its way past — but this is the only one of the three that can say what
 * is wrong with the file before a round trip has spent the person's time.
 */
export function AvatarField({ name, url, onChoose, onRemove }: AvatarFieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    /*
     * Cleared straight away, and before anything can return early. Picking the
     * same file twice in a row is a real case — wrong one, right one, then the
     * first again — and an input still holding that value fires no change
     * event the second time, so the upload silently does not happen.
     */
    if (input.current) input.current.value = '';

    if (!file) return;

    setError(null);

    const problem = avatarFileProblem({ type: file.type, size: file.size });

    if (problem) {
      setError(t(problem));
      return;
    }

    setBusy(true);
    try {
      await onChoose({ body: file, type: file.type, size: file.size });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      await onRemove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-content-muted">{t('profile.photo')}</span>

      <div className="flex flex-row items-center gap-gutter">
        <Avatar testID="profile-avatar" name={name} url={url} size="lg" />

        <div className="flex flex-col gap-2">
          {/* A styled label rather than a styled button: the input is the
              control, and wiring a button to click() hidden input loses
              keyboard focus behaviour that the label gets for free. */}
          <label htmlFor={inputId} className={buttonContainerClass('secondary', 'sm', busy)}>
            <span className={buttonLabelClass('secondary', 'sm')}>
              {t(
                busy
                  ? 'profile.uploadingPhoto'
                  : url
                    ? 'profile.replacePhoto'
                    : 'profile.choosePhoto',
              )}
            </span>
          </label>

          <input
            id={inputId}
            ref={input}
            data-testid="avatar-input"
            type="file"
            accept={AVATAR_MIME_TYPES.join(',')}
            disabled={busy}
            onChange={handleChange}
            className="sr-only"
          />

          {url ? (
            <button
              type="button"
              data-testid="avatar-remove"
              disabled={busy}
              onClick={handleRemove}
              className={buttonLabelClass('ghost', 'sm')}
            >
              {t('profile.removePhoto')}
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-content-muted">{t('profile.photoExplainer')}</p>

      {error ? (
        <p role="alert" data-testid="avatar-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
