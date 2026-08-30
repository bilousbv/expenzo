import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import {
  acceptInvitation,
  listPendingInvitations,
  previewInvitation,
  revokeInvitation,
  sendInvitation,
} from './invitations';

const invitation = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ben@example.com',
  role: 'child' as const,
  created_at: '2026-08-30T09:00:00.000Z',
  expires_at: '2026-09-13T09:00:00.000Z',
};

function selectDb(result: { data: unknown; error: { message: string } | null }) {
  const calls: { columns: string[]; filters: [string, unknown][]; order: string[] } = {
    columns: [],
    filters: [],
    order: [],
  };

  const builder = {
    select(selection: string) {
      calls.columns.push(selection);
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.filters.push([column, value]);
      return builder;
    },
    order(column: string) {
      calls.order.push(column);
      return Promise.resolve(result);
    },
  };

  return { db: { from: vi.fn(() => builder) } as unknown as Db, calls };
}

describe('listPendingInvitations', () => {
  it('asks only for what is still outstanding', async () => {
    const { db, calls } = selectDb({ data: [invitation], error: null });

    await expect(listPendingInvitations(db)).resolves.toEqual([
      {
        id: invitation.id,
        email: 'ben@example.com',
        role: 'child',
        expiresAt: invitation.expires_at,
      },
    ]);

    expect(calls.filters).toContainEqual(['status', 'pending']);
  });

  // The token hash is deliberately absent from the column list: nothing on a
  // screen has any use for it, and a column not selected cannot be leaked.
  it('never selects the token hash', async () => {
    const { db, calls } = selectDb({ data: [], error: null });

    await listPendingInvitations(db);

    expect(calls.columns[0]).not.toContain('token_hash');
  });

  it('throws the database message', async () => {
    const { db } = selectDb({ data: null, error: { message: 'JWT expired' } });

    await expect(listPendingInvitations(db)).rejects.toThrow('JWT expired');
  });
});

describe('revokeInvitation', () => {
  it('marks it revoked rather than deleting it', async () => {
    const patch: Record<string, unknown>[] = [];
    const filters: [string, unknown][] = [];

    const builder = {
      update(values: Record<string, unknown>) {
        patch.push(values);
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return Promise.resolve({ error: null });
      },
    };

    const db = { from: vi.fn(() => builder) } as unknown as Db;

    await revokeInvitation(db, invitation.id);

    expect(patch[0]).toEqual({ status: 'revoked' });
    expect(filters).toEqual([['id', invitation.id]]);
  });
});

describe('sendInvitation', () => {
  it('posts the address and role to the function that owns the email', async () => {
    const invoke = vi.fn(() => Promise.resolve({ data: { ok: true }, error: null }));
    const db = { functions: { invoke } } as unknown as Db;

    await sendInvitation(db, { email: '  Ben@Example.COM ', role: 'child' }, 'uk');

    expect(invoke).toHaveBeenCalledWith('send-invitation', {
      // Lowercased on the way out, the way GoTrue stores an address.
      body: { email: 'ben@example.com', role: 'child', locale: 'uk' },
    });
  });

  it('defaults to inviting an adult', async () => {
    const invoke = vi.fn(() => Promise.resolve({ data: { ok: true }, error: null }));
    const db = { functions: { invoke } } as unknown as Db;

    await sendInvitation(db, { email: 'ben@example.com' }, 'en');

    expect(invoke).toHaveBeenCalledWith('send-invitation', {
      body: { email: 'ben@example.com', role: 'adult', locale: 'en' },
    });
  });

  // A refusal carries a reason the person inviting needs to read — "Only an
  // owner or adult can invite" is the whole answer to why the button did
  // nothing.
  it('surfaces what the function said went wrong', async () => {
    const invoke = vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code' },
        // The Supabase client puts the status body behind context.
        context: { json: () => Promise.resolve({ error: 'Only an owner or adult can invite' }) },
      }),
    );
    const db = { functions: { invoke } } as unknown as Db;

    await expect(sendInvitation(db, { email: 'ben@example.com' }, 'en')).rejects.toThrow(
      'Only an owner or adult can invite',
    );
  });

  it('refuses an address that is not one before calling anything', async () => {
    const invoke = vi.fn();
    const db = { functions: { invoke } } as unknown as Db;

    await expect(sendInvitation(db, { email: 'not-an-address' }, 'en')).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('previewInvitation', () => {
  it('reads the household and whether the invitee already has an account', async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            household_name: 'Bilous',
            invitee_email: 'ben@example.com',
            invitee_role: 'child',
            account_exists: true,
          },
        ],
        error: null,
      }),
    );
    const db = { rpc } as unknown as Db;

    await expect(previewInvitation(db, 'a-token')).resolves.toEqual({
      householdName: 'Bilous',
      email: 'ben@example.com',
      role: 'child',
      accountExists: true,
    });

    expect(rpc).toHaveBeenCalledWith('invitation_preview', { token: 'a-token' });
  });

  // A spent, revoked or unknown token all return no rows. The page shows one
  // message for the three, which is also the one that gives nothing away.
  it('returns null when the token buys nothing', async () => {
    const db = { rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) } as unknown as Db;

    await expect(previewInvitation(db, 'spent')).resolves.toBeNull();
  });
});

describe('acceptInvitation', () => {
  it('redeems the token and answers with the household joined', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'household-id', error: null }));
    const db = { rpc } as unknown as Db;

    await expect(acceptInvitation(db, 'a-token')).resolves.toBe('household-id');
    expect(rpc).toHaveBeenCalledWith('accept_household_invitation', { token: 'a-token' });
  });

  it('throws what the database said', async () => {
    const db = {
      rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'This has expired' } })),
    } as unknown as Db;

    await expect(acceptInvitation(db, 'old')).rejects.toThrow('This has expired');
  });
});
