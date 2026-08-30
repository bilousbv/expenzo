import { inviteInput, type InvitableRole } from '@expenzo/domain';

import type { Db } from '../types';

/**
 * Inviting someone, and everything the invitation does afterwards.
 *
 * The token is not here and never reaches a client: `send-invitation` asks the
 * database for one and puts it straight into an email. What a screen can see is
 * the address, the role and when the invitation runs out.
 */

/**
 * One string literal, not a concatenation: PostgREST infers the row type by
 * parsing this as a type, and anything built with `+` widens to
 * `GenericStringError[]`. `token_hash` is left out on purpose — no screen has a
 * use for it, and a column not selected cannot be leaked.
 */
const COLUMNS = 'id, email, role, expires_at';

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
}

/** What the landing page knows before anybody has signed in. */
export interface InvitationPreview {
  readonly householdName: string;
  readonly email: string;
  /** What the invitation offers, so the landing page can name it. */
  readonly role: string;
  /** Which of sign in or register the visitor should be shown. */
  readonly accountExists: boolean;
}

/**
 * Invitations still outstanding.
 *
 * Row-level security scopes this to the caller's household, so it carries no
 * household filter of its own.
 */
export async function listPendingInvitations(db: Db): Promise<InvitationRow[]> {
  const { data, error } = await db
    .from('household_invitations')
    .select(COLUMNS)
    .eq('status', 'pending')
    .order('created_at');

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
  }));
}

/**
 * Withdrawing one.
 *
 * Revoked rather than deleted: the row is the record that somebody was asked,
 * and `accept_household_invitation` only ever honours a pending one.
 */
export async function revokeInvitation(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('household_invitations')
    .update({ status: 'revoked' })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Why a failing invoke needs unwrapping.
 *
 * supabase-js reports every non-2xx as the same generic message and hangs the
 * real body off `context`. "Only an owner or adult can invite" is the entire
 * answer to why the button did nothing, so it is worth going after.
 */
async function reasonFor(error: { message: string }, context: unknown): Promise<string> {
  const response = context as { json?: () => Promise<{ error?: string }> } | undefined;

  if (typeof response?.json !== 'function') return error.message;

  try {
    const body = await response.json();
    return body.error ?? error.message;
  } catch {
    return error.message;
  }
}

/**
 * Issuing an invitation and having it emailed.
 *
 * The edge function does both, in that order, with the caller's own token — so
 * whether this person may invite at all is still decided by
 * `create_household_invitation` rather than by whoever called this.
 */
export async function sendInvitation(
  db: Db,
  input: { email: string; role?: InvitableRole },
  locale: string,
): Promise<void> {
  const parsed = inviteInput.parse(input);

  const { error, ...rest } = await db.functions.invoke('send-invitation', {
    // The locale picks which of the two languages the email is written in.
    // The catalogue itself cannot be reached from Deno, so the copy lives in
    // the function and this says which half to use.
    body: { email: parsed.email, role: parsed.role, locale },
  });

  if (error) throw new Error(await reasonFor(error, (rest as { context?: unknown }).context));
}

/**
 * What an invitation link is worth, read without a session.
 *
 * A spent, revoked, expired or invented token all return nothing, which is
 * both the honest answer and the one that gives nothing away about which.
 */
export async function previewInvitation(db: Db, token: string): Promise<InvitationPreview | null> {
  const { data, error } = await db.rpc('invitation_preview', { token });

  if (error) throw new Error(error.message);

  const row = (data ?? [])[0];
  if (!row) return null;

  return {
    householdName: row.household_name,
    email: row.invitee_email,
    role: row.invitee_role,
    accountExists: row.account_exists,
  };
}

/** Redeeming one. Answers with the household just joined. */
export async function acceptInvitation(db: Db, token: string): Promise<string> {
  const { data, error } = await db.rpc('accept_household_invitation', { token });

  if (error) throw new Error(error.message);

  return data as string;
}
