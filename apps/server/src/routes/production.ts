import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createBatchSchema = z.object({
  productId: z.string(),
  quantityProduced: z.number().positive(),
  quantityUnit: z.string().min(1),
  notes: z.string().optional(),
});

// GET /api/production
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const date = req.query.date as string | undefined;

    const where: Record<string, unknown> = {};
    if (date) {
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where.startedAt = { gte: day, lt: nextDay };
    }

    const [batches, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        include: { product: true, user: { select: { id: true, name: true } } },
        skip,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.productionBatch.count({ where }),
    ]);
    res.json({ data: batches, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// POST /api/production
router.post(
  '/',
  requireRole('admin', 'baker'),
  asyncHandler(async (req, res) => {
    const { productId, quantityProduced, quantityUnit, notes } = createBatchSchema.parse(req.body);

    const batch = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new AppError(404, 'Product not found');

      // Create batch with placeholder batchNumber
      const created = await tx.productionBatch.create({
        data: {
          productId,
          batchNumber: 'TEMP',
          quantityProduced,
          quantityUnit,
          producedBy: req.user!.id,
          notes,
        },
      });

      // Update with formatted batchNumber
      const updated = await tx.productionBatch.update({
        where: { id: created.id },
        data: {
          batchNumber: `PB-${String(created.batchSequence).padStart(4, '0')}`,
        },
      });

      return updated;
    });

    getIO().emit('production:updated', { batchId: batch.id });
    res.status(201).json(batch);
  }),
);

// PATCH /api/production/:id/complete
router.patch(
  '/:id/complete',
  requireRole('admin', 'baker'),
  asyncHandler(async (req, res) => {
    const batch = await prisma.productionBatch.findUnique({ where: { id: getParam(req, 'id') } });
    if (!batch) throw new AppError(404, 'Production batch not found');
    if (batch.status !== 'in_progress') throw new AppError(400, 'Batch is not in progress');

    const updated = await prisma.productionBatch.update({
      where: { id: getParam(req, 'id') },
      data: { status: 'completed', completedAt: new Date() },
    });

    getIO().emit('production:updated', { batchId: updated.id, status: 'completed' });
    res.json(updated);
  }),
);

// GET /api/production/targets/previous-shortage?productId=...&date=...
router.get(
  '/targets/previous-shortage',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const productId = req.query.productId as string;
    const dateStr = req.query.date as string;

    if (!productId || !dateStr) {
      throw new AppError(400, 'productId and date are required');
    }

    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);

    const prevTarget = await prisma.dailyProductionTarget.findFirst({
      where: {
        productId,
        targetDate: {
          gte: prevDate,
          lt: targetDate,
        },
      },
    });

    res.json({ shortage: prevTarget?.shortage ?? 0 });
  }),
);

const createTargetSchema = z.object({
  productId: z.string(),
  date: z.string(), // ISO date string
  target: z.number().int().min(0),
  actual: z.number().int().min(0).optional().default(0),
  carriedOver: z.number().int().min(0).optional().default(0),
  shortage: z.number().int().min(0).optional().default(0),
});

const updateTargetSchema = z.object({
  target: z.number().int().min(0).optional(),
  actual: z.number().int().min(0).optional(),
  carriedOver: z.number().int().min(0).optional(),
  shortage: z.number().int().min(0).optional(),
});

// GET /api/production/targets
router.get(
  '/targets',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const date = req.query.date as string | undefined;

    const where: Record<string, unknown> = {};
    if (date) {
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where.targetDate = { gte: day, lt: nextDay };
    }

    const [targets, total] = await Promise.all([
      prisma.dailyProductionTarget.findMany({
        where,
        include: { product: true },
        skip,
        take,
        orderBy: { targetDate: 'desc' },
      }),
      prisma.dailyProductionTarget.count({ where }),
    ]);
    res.json({ data: targets, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// POST /api/production/targets
router.post(
  '/targets',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const data = createTargetSchema.parse(req.body);
    const targetDate = new Date(data.date);
    targetDate.setHours(0, 0, 0, 0);

    const target = await prisma.dailyProductionTarget.create({
      data: {
        productId: data.productId,
        targetDate,
        targetQty: data.target,
        actualQty: data.actual,
        carriedOverShortage: data.carriedOver,
        shortage: data.shortage,
      },
      include: { product: true },
    });
    res.status(201).json(target);
  }),
);

// PUT /api/production/targets/:id
router.put(
  '/targets/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const data = updateTargetSchema.parse(req.body);
    const updateData: Record<string, any> = {};
    if (data.target !== undefined) updateData.targetQty = data.target;
    if (data.actual !== undefined) updateData.actualQty = data.actual;
    if (data.carriedOver !== undefined) updateData.carriedOverShortage = data.carriedOver;
    if (data.shortage !== undefined) updateData.shortage = data.shortage;

    const target = await prisma.dailyProductionTarget.update({
      where: { id: getParam(req, 'id') },
      data: updateData,
      include: { product: true },
    });
    res.json(target);
  }),
);

export default router;
