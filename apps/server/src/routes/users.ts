import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

const ROLES = ['admin', 'owner', 'cashier', 'baker'] as const;

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

/** Strip the hashed password before returning a user row to the client. */
function safeUser<T extends { passwordHash: string }>(u: T) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

// GET /api/users — list all users (admin + owner)
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const where = includeInactive ? {} : { isActive: true };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users.map(safeUser),
      total,
      page: req.pagination.page,
      limit: req.pagination.limit,
    });
  }),
);

// POST /api/users — create a staff account
router.post(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const actor = req.user!;

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'A user with that email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
          passwordHash,
          // Force the user to change the admin-set password on first login.
          mustChangePassword: true,
        },
      });
      await recordAudit(tx, {
        entity: 'user',
        entityId: u.id,
        action: 'create',
        userId: actor.id,
        after: { name: u.name, email: u.email, role: u.role },
      });
      return u;
    });

    res.status(201).json(safeUser(created));
  }),
);

// PATCH /api/users/:id — edit basic fields (not password)
router.patch(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const data = updateUserSchema.parse(req.body);
    const actor = req.user!;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'User not found');

    // Prevent users from disabling or demoting themselves — easy way to
    // accidentally lock yourself out as the only admin.
    if (id === actor.id) {
      if (data.isActive === false) {
        throw new AppError(400, "You can't deactivate your own account");
      }
      if (data.role && data.role !== existing.role) {
        throw new AppError(400, "You can't change your own role");
      }
    }

    if (data.email && data.email !== existing.email) {
      const dupe = await prisma.user.findUnique({ where: { email: data.email } });
      if (dupe) throw new AppError(409, 'A user with that email already exists');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data });
      await recordAudit(tx, {
        entity: 'user',
        entityId: id,
        action: 'update',
        userId: actor.id,
        before: {
          name: existing.name,
          email: existing.email,
          role: existing.role,
          isActive: existing.isActive,
        },
        after: {
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
        },
      });
      return u;
    });

    res.json(safeUser(updated));
  }),
);

// DELETE /api/users/:id — soft delete via isActive=false
router.delete(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const actor = req.user!;
    if (id === actor.id) {
      throw new AppError(400, "You can't deactivate your own account");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'User not found');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { isActive: false } });
      await recordAudit(tx, {
        entity: 'user',
        entityId: id,
        action: 'delete',
        userId: actor.id,
        before: { isActive: true },
        after: { isActive: false },
      });
      return u;
    });

    res.json(safeUser(updated));
  }),
);

// POST /api/users/:id/reset-password — admin sets a new temporary password.
// The user must change it on next login (mustChangePassword=true).
router.post(
  '/:id/reset-password',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const actor = req.user!;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'User not found');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await recordAudit(tx, {
        entity: 'user',
        entityId: id,
        action: 'password_reset',
        userId: actor.id,
        reason: actor.id === id ? 'Self password reset' : 'Admin password reset',
      });
    });

    res.json({ message: 'Password reset. User must change it on next login.' });
  }),
);

export default router;
