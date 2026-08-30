import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { removeMember, setMemberRole } from './members';

const member = '22222222-2222-4222-8222-222222222222';

describe('setMemberRole', () => {
  it('goes through the function that owns the rules', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const db = { rpc } as unknown as Db;

    await setMemberRole(db, member, 'child');

    expect(rpc).toHaveBeenCalledWith('set_member_role', { member, new_role: 'child' });
  });

  // household_members has no client-writable policy at all, so the refusal
  // that matters arrives as an error from the function rather than as a row
  // that quietly did not change.
  it('throws what the database said', async () => {
    const db = {
      rpc: vi.fn(() =>
        Promise.resolve({ data: null, error: { message: 'The household owner keeps their role' } }),
      ),
    } as unknown as Db;

    await expect(setMemberRole(db, member, 'adult')).rejects.toThrow(
      'The household owner keeps their role',
    );
  });
});

describe('removeMember', () => {
  it('goes through the function too', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const db = { rpc } as unknown as Db;

    await removeMember(db, member);

    expect(rpc).toHaveBeenCalledWith('remove_household_member', { member });
  });

  it('surfaces the refusal to remove an owner', async () => {
    const db = {
      rpc: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'The household owner cannot be removed' },
        }),
      ),
    } as unknown as Db;

    await expect(removeMember(db, member)).rejects.toThrow('The household owner cannot be removed');
  });
});
