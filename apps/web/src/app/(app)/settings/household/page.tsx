import { personDisplayName } from '@expenzo/domain';
import { signedAvatarUrls } from '@expenzo/data';
import { Avatar, Card } from '@expenzo/ui';
import { headers } from 'next/headers';
import Link from 'next/link';

import { HouseholdInvite } from '@/features/household/household-invite';
import { LanguageSwitcher } from '@/features/settings/language-switcher';
import { ThemeSwitcher } from '@/features/settings/theme-switcher';
import { getLocale, getTranslations } from '@/lib/i18n/server';
import { getTheme } from '@/lib/theme/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.household') };
}

export default async function HouseholdSettingsPage() {
  const { t } = await getTranslations();
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const supabase = await createClient();

  // Row-level security scopes both of these to the caller's household, so
  // neither query needs a household filter of its own.
  // Fetched separately rather than as a nested select: household_members and
  // profiles both reference auth.users but have no foreign key between them,
  // so PostgREST cannot infer the relationship. Adding one purely to satisfy a
  // join would be schema shaped around a query.
  const [{ data: household }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from('households').select('id, name, base_currency, timezone').maybeSingle(),
    supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('status', 'active')
      .order('joined_at'),
    supabase.from('profiles').select('id, first_name, last_name, display_name, avatar_path'),
  ]);

  // The bucket is private, so a usable URL has to be signed at read time. One
  // request for the whole roster rather than one per member: a household of
  // five would otherwise be five round trips before any face appeared.
  const avatarUrls = await signedAvatarUrls(
    supabase,
    (profiles ?? []).map((profile) => profile.avatar_path ?? ''),
  );

  // Assembled by the domain helper rather than here, so the roster, the expense
  // rows and the mobile screen cannot drift into naming the same person three
  // different ways.
  const nameFor = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      personDisplayName({
        firstName: profile.first_name,
        lastName: profile.last_name,
        displayName: profile.display_name,
      }),
    ]),
  );

  const avatarFor = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.avatar_path ? (avatarUrls.get(profile.avatar_path) ?? null) : null,
    ]),
  );

  // Building the invite link needs the host the browser actually used, and a
  // server component has no window.
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-gutter p-gutter">
      <h1 className="text-3xl font-bold text-content">{household?.name ?? t('household.title')}</h1>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('household.members')}</h2>

        <ul className="flex flex-col gap-2">
          {(members ?? []).map((member) => (
            <li key={member.user_id} className="flex items-center justify-between">
              <span className="flex items-center gap-3">
                <Avatar
                  name={nameFor.get(member.user_id) ?? t('common.member')}
                  url={avatarFor.get(member.user_id) ?? null}
                  size="sm"
                />
                <span className="text-content" data-testid="member-name">
                  {nameFor.get(member.user_id) ?? t('common.member')}
                </span>
              </span>
              <span className="text-sm text-content-muted">{member.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('household.inviteSomeone')}</h2>
        <HouseholdInvite origin={origin} />
      </Card>

      <Card className="gap-gutter">
        <LanguageSwitcher locale={locale} />
        <ThemeSwitcher theme={theme} />
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('categories.title')}</h2>
        <Link href="/settings/categories" className="text-link underline">
          {t('nav.manageCategories')}
        </Link>
      </Card>
    </main>
  );
}
