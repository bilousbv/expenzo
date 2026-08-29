'use client';

import { useTranslation } from '@expenzo/i18n';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/browser';

import { LoginForm } from './login-form';
import { callbackUrl } from './urls';

/**
 * The magic link on a page of its own.
 *
 * It used to unfold inside the login card, which put two email fields on one
 * screen — ambiguous to fill, and ambiguous to every locator that had to reach
 * one of them. Asking for a link is a different decision from typing a
 * password rather than a variation on it, so it gets its own address.
 */
export function MagicLinkPanel() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/';

  async function sendMagicLink(email: string) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(window.location.origin, redirectTo) },
    });

    if (error) throw new Error(error.message);
  }

  return (
    /* Still carrying the test id the section had: it is what scopes the e2e
       locators, and the page is reached from more than one place. */
    <div data-testid="magic-link" className="flex flex-col gap-gutter">
      <p className="text-sm text-content-muted">{t('auth.magicLinkExplainer')}</p>

      <LoginForm onSubmit={sendMagicLink} />

      <p className="text-center text-sm">
        {/* The destination travels back too, so backing out of the magic link
            does not quietly cost you the page you were trying to open. */}
        <Link
          href={redirectTo === '/' ? '/login' : `/login?next=${encodeURIComponent(redirectTo)}`}
          className="text-link underline"
          data-testid="back-to-login"
        >
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
