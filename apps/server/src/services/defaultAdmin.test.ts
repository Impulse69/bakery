import { describe, expect, it, vi } from 'vitest';
import { ensureDefaultAdmin } from './defaultAdmin.js';

describe('ensureDefaultAdmin', () => {
  it('creates an admin when the database has no users', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          email: 'owner@example.com',
          role: 'admin',
        }),
      },
    };
    const bcrypt = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
    };

    const result = await ensureDefaultAdmin(prisma as any, bcrypt as any, {
      email: 'owner@example.com',
      password: 'secret123',
      name: 'Owner',
    });

    expect(result).toEqual({
      created: true,
      email: 'owner@example.com',
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Owner',
        email: 'owner@example.com',
        passwordHash: 'hashed-password',
        role: 'admin',
        isActive: true,
      },
    });
  });

  it('does not change credentials when users already exist', async () => {
    const prisma = {
      user: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn(),
      },
    };
    const bcrypt = {
      hash: vi.fn(),
    };

    const result = await ensureDefaultAdmin(prisma as any, bcrypt as any, {
      email: 'owner@example.com',
      password: 'secret123',
      name: 'Owner',
    });

    expect(result).toEqual({ created: false, reason: 'users-exist' });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
