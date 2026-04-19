import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { syncProductAvailability } from '../services/products.js';

const router = Router();

const createBatchSchema = z.object({
  productId: z.string(),
  quantityProduced: z.number().positive(),
  quantityUnit: z.string().min(1),
  notes: z.string().optional(),
});

const dailyRunInitializeSchema = z.array(z.object({
  productId: z.string(),
  target: z.number().int().min(0),
  carriedOver: z.number().int().min(0),
}));

const dailyRunCompleteSchema = z.array(z.object({
  productId: z.string(),
  actual: z.number().int().min(0),
}));

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

// --- DAILY RUN ROUTES (Static first) ---

// GET /api/production/daily-run
router.get(
  '/daily-run',
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr) throw new AppError(400, 'date is required');

    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Check if targets exist for this date
    const targets = await prisma.dailyProductionTarget.findMany({
      where: {
        targetDate: { gte: targetDate, lt: nextDay }
      },
      include: { product: true }
    });

    if (targets.length > 0) {
      res.json({ status: targets[0].status, targets });
      return;
    }

    // 2. If not, generate suggestions for all bread products
    const allProducts = await prisma.product.findMany();
    const breadProducts = allProducts.filter(p => p.category?.toLowerCase().includes('bread'));

    const suggestions = await Promise.all(breadProducts.map(async (product) => {
      const lastTarget = await prisma.dailyProductionTarget.findFirst({
        where: {
          productId: product.id,
          targetDate: { lt: targetDate }
        },
        orderBy: { targetDate: 'desc' }
      });

      return {
        productId: product.id,
        product,
        carriedOverShortage: lastTarget?.shortage || 0,
      };
    }));

    res.json({ status: 'not_started', suggestions });
  })
);

// POST /api/production/daily-run
router.post(
  '/daily-run',
  requireRole('admin', 'owner', 'baker'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr) throw new AppError(400, 'date is required');
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const data = dailyRunInitializeSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of data) {
        const t = await tx.dailyProductionTarget.create({
          data: {
            targetDate,
            productId: item.productId,
            targetQty: item.target,
            carriedOverShortage: item.carriedOver,
            status: 'in_progress',
          },
          include: { product: true }
        });
        results.push(t);
      }
      return results;
    });

    res.status(201).json(created);
  })
);

// PATCH /api/production/daily-run/complete
router.patch(
  '/daily-run/complete',
  requireRole('admin', 'owner', 'baker'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string;
    if (!dateStr) throw new AppError(400, 'date is required');
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const data = dailyRunCompleteSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of data) {
        const target = await tx.dailyProductionTarget.findFirst({
          where: { productId: item.productId, targetDate: { gte: targetDate, lt: nextDay } }
        });

        if (!target) continue;

        const shortage = Math.max(0, (target.targetQty + target.carriedOverShortage) - item.actual);

        const updatedTarget = await tx.dailyProductionTarget.update({
          where: { id: target.id },
          data: {
            actualQty: item.actual,
            shortage,
            status: 'completed'
          },
          include: { product: true }
        });

        if (item.actual > 0) {
          // Create production batch
          const createdBatch = await tx.productionBatch.create({
            data: {
              productId: item.productId,
              batchNumber: 'TEMP',
              quantityProduced: item.actual,
              quantityUnit: 'units',
              status: 'completed',
              producedBy: req.user!.id,
              completedAt: new Date()
            }
          });

          await tx.productionBatch.update({
            where: { id: createdBatch.id },
            data: { batchNumber: `PB-${String(createdBatch.batchSequence).padStart(4, '0')}` }
          });

          // Increment stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.actual } }
          });
          await syncProductAvailability(tx, item.productId);
        }

        results.push(updatedTarget);
      }
      return results;
    });

    // We emit empty so client can just fetch anything needed.
    getIO().emit('products:stock-updated', []);
    getIO().emit('production:updated', {});

    res.json(updated);
  })
);

// --- OTHER TARGET ROUTES ---

// GET /api/production/targets/previous-shortage
router.get(
  '/targets/previous-shortage',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const productId = req.query.productId as string;
    const dateStr = req.query.date as string;
    if (!productId || !dateStr) throw new AppError(400, 'productId and date are required');

    const day = new Date(dateStr);
    day.setHours(0, 0, 0, 0);

    const prev = await prisma.dailyProductionTarget.findFirst({
      where: {
        productId,
        targetDate: { lt: day },
      },
      orderBy: { targetDate: 'desc' },
    });

    res.json({ shortage: prev?.shortage || 0 });
  }),
);

// GET /api/production/targets
router.get(
  '/targets',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const dateStr = req.query.date as string;

    const where: Record<string, unknown> = {};
    if (dateStr) {
      const day = new Date(dateStr);
      day.setHours(0, 0, 0, 0);
      where.targetDate = day;
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
    const { productId, date, target, actual, carriedOver, shortage } = createTargetSchema.parse(req.body);

    const day = new Date(date);
    day.setHours(0, 0, 0, 0);

    const created = await prisma.dailyProductionTarget.upsert({
      where: {
        targetDate_productId: {
          targetDate: day,
          productId,
        },
      },
      update: {
        targetQty: target,
        actualQty: actual,
        carriedOverShortage: carriedOver,
        shortage,
      },
      create: {
        targetDate: day,
        productId,
        targetQty: target,
        actualQty: actual,
        carriedOverShortage: carriedOver,
        shortage,
      },
      include: { product: true },
    });

    res.status(201).json(created);
  }),
);

// PUT /api/production/targets/:id
router.put(
  '/targets/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const data = updateTargetSchema.parse(req.body);

    const updateData: any = {};
    if (data.target !== undefined) updateData.targetQty = data.target;
    if (data.actual !== undefined) updateData.actualQty = data.actual;
    if (data.carriedOver !== undefined) updateData.carriedOverShortage = data.carriedOver;
    if (data.shortage !== undefined) updateData.shortage = data.shortage;

    const updated = await prisma.dailyProductionTarget.update({
      where: { id },
      data: updateData,
      include: { product: true },
    });

    res.json(updated);
  }),
);

// --- BATCH ROUTES (Dynamic last) ---

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
// Reserved for future ad-hoc batch tooling — no UI surface today.
// (The Daily Run flow auto-creates ProductionBatch rows on day close.)
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
// Reserved for future ad-hoc batch tooling — no UI surface today.
router.patch(
  '/:id/complete',
  requireRole('admin', 'baker'),
  asyncHandler(async (req, res) => {
    const batchId = getParam(req, 'id');
    const batch = await prisma.productionBatch.findUnique({ where: { id: batchId } });

    if (!batch) throw new AppError(404, 'Production batch not found');
    if (batch.status !== 'in_progress') throw new AppError(400, 'Batch is not in progress');

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Mark batch as completed
      const b = await tx.productionBatch.update({
        where: { id: batchId },
        data: { status: 'completed', completedAt: new Date() },
      });

      // 2. Increment the product stock
      await tx.product.update({
        where: { id: batch.productId },
        data: {
          stockQuantity: { increment: batch.quantityProduced }
        }
      });
      await syncProductAvailability(tx, batch.productId);

      return b;
    });

    getIO().emit('production:updated', { batchId: updated.id, status: 'completed' });

    // Emit stock update for the product
    const updatedProduct = await prisma.product.findUnique({
      where: { id: batch.productId },
      select: { id: true, stockQuantity: true }
    });
    if (updatedProduct) {
      getIO().emit('products:stock-updated', [updatedProduct]);
    }

    res.json(updated);
  }),
);

export default router;
