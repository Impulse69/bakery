import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import type { Prisma } from '@prisma/client';

const router = Router();

// GET /api/audit
// Filters: from, to (ISO), userId, entity, action, page, limit.
// Admin + owner only.
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const { from, to, userId, entity, action } = req.query as Record<string, string | undefined>;

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity as Prisma.AuditLogWhereInput['entity'];
    if (action) where.action = action as Prisma.AuditLogWhereInput['action'];
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data: logs, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

export default router;
