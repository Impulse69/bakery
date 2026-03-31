import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createBatchSchema = z.object({
  recipeId: z.string(),
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
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.startedAt = { gte: day, lt: nextDay };
    }

    const [batches, total] = await Promise.all([
      prisma.productionBatch.findMany({
        where,
        include: { recipe: true, user: { select: { id: true, name: true } } },
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
    const { recipeId, quantityProduced, quantityUnit, notes } = createBatchSchema.parse(req.body);

    const batch = await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: { ingredients: true },
      });
      if (!recipe) throw new AppError(404, 'Recipe not found');

      // Calculate multiplier based on how many batches of the yield we're producing
      const multiplier = quantityProduced / recipe.yieldQuantity;

      // Create batch with placeholder batchNumber
      const created = await tx.productionBatch.create({
        data: {
          recipeId,
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

      // Pre-check: verify sufficient stock for all ingredients
      for (const ingredient of recipe.ingredients) {
        const item = await tx.inventoryItem.findUnique({ where: { id: ingredient.inventoryItemId } });
        if (!item) throw new AppError(404, `Inventory item not found: ${ingredient.inventoryItemId}`);
        const required = ingredient.quantityRequired * multiplier;
        if (item.quantityOnHand < required) {
          throw new AppError(
            400,
            `Insufficient stock for ${item.name}: need ${required} ${ingredient.unit}, have ${item.quantityOnHand}`,
          );
        }
      }

      // Deduct ingredients from inventory
      for (const ingredient of recipe.ingredients) {
        const deduction = ingredient.quantityRequired * multiplier;

        await tx.stockAdjustment.create({
          data: {
            inventoryItemId: ingredient.inventoryItemId,
            quantityChange: -deduction,
            adjustmentType: 'production',
            referenceId: updated.id,
            notes: `Production batch ${updated.batchNumber}`,
            createdBy: req.user!.id,
          },
        });

        await tx.inventoryItem.update({
          where: { id: ingredient.inventoryItemId },
          data: { quantityOnHand: { decrement: deduction } },
        });
      }

      return updated;
    });

    getIO().emit('production:updated', { batchId: batch.id });
    getIO().emit('stock:updated', { reason: 'production_deduction', batchId: batch.id });
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
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: day, lt: nextDay };
    }

    const [targets, total] = await Promise.all([
      prisma.dailyProductionTarget.findMany({
        where,
        include: { product: true },
        skip,
        take,
        orderBy: { date: 'desc' },
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
        ...data,
        date: targetDate,
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
    const target = await prisma.dailyProductionTarget.update({
      where: { id: getParam(req, 'id') },
      data,
      include: { product: true },
    });
    res.json(target);
  }),
);

export default router;
