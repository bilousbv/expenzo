'use client';

import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useState } from 'react';

/** Matches the providers configured in supabase/config.toml. */
export type OAuthProvider = 'google' | 'apple';

export const OAUTH_LABEL_KEY: Record<OAuthProvider, string> = {
  google: 'auth.continueWithGoogle',
  apple: 'auth.continueWithApple',
};

export interface OAuthButtonsProps {
  /** Only providers with credentials configured. An empty list renders nothing. */
  providers: OAuthProvider[];
  onSignIn: (provider: OAuthProvider) => Promise<void>;
}

export function OAuthButtons({ providers, onSignIn }: OAuthButtonsProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A button for a provider with no credentials can only fail. Rendering
  // nothing is better than rendering a trap.
  if (providers.length === 0) return null;

  async function handleClick(provider: OAuthProvider) {
    // A successful call navigates away, so there is no re-render to disable the
    // buttons — the second click has to be refused here.
    if (busy) return;

    setError(null);
    setBusy(provider);
    try {
      await onSignIn(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth.errors.providerUnreachable'));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={busy !== null}
          onClick={() => void handleClick(provider)}
          className={buttonContainerClass('secondary', 'md', busy !== null)}
        >
          <span className={buttonLabelClass('secondary', 'md')}>
            {t(OAUTH_LABEL_KEY[provider])}
          </span>
        </button>
      ))}

      {error ? (
        <p role="alert" data-testid="oauth-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
