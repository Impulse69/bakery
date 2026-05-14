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
    const carryFrom = req.query.carryFrom as string | undefined;
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

    // 1.5 Find the latest day with ANY shortage
    const latestTargetWithShortage = await prisma.dailyProductionTarget.findFirst({
      where: {
        targetDate: { lt: targetDate },
        shortage: { gt: 0 },
        product: { isActive: true },
      },
      orderBy: { targetDate: 'desc' },
      select: { targetDate: true },
    });

    let latestShortage = null;
    if (latestTargetWithShortage) {
      const date = latestTargetWithShortage.targetDate;
      const dayShortages = await prisma.dailyProductionTarget.aggregate({
        where: { targetDate: date, shortage: { gt: 0 } },
        _sum: { shortage: true },
      });
      latestShortage = {
        date: date.toISOString().split('T')[0],
        totalUnits: dayShortages._sum.shortage || 0,
      };
    }

    if (targets.length > 0) {
      const activeTargets = targets.filter(
        (t) =>
          t.product.isActive ||
          t.targetQty > 0 ||
          t.actualQty > 0 ||
          t.carriedOverShortage > 0,
      );
      res.json({
        status: targets[0].status,
        targets: activeTargets,
        latestShortage,
      });
      return;
    }

    // 2. If not, generate suggestions for all active bread products
    const breadProducts = await prisma.product.findMany({
      where: {
        category: { contains: 'bread', mode: 'insensitive' },
        isActive: true,
      },
    });

    const suggestions = await Promise.all(breadProducts.map(async (product) => {
      let shortage = 0;
      let sourceDate = null;

      if (carryFrom) {
        const prev = await prisma.dailyProductionTarget.findUnique({
          where: {
            targetDate_productId: {
              targetDate: new Date(carryFrom),
              productId: product.id,
            },
          },
        });
        shortage = prev?.shortage || 0;
        sourceDate = carryFrom;
      }

      return {
        productId: product.id,
        product,
        carriedOverShortage: shortage,
        sourceDate,
      };
    }));

    res.json({ status: 'not_started', suggestions, latestShortage });
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

// GET /api/production/history
// Returns a paginated, day-grouped read of past production activity for
// admins and owners. Days with zero batches are excluded.
router.get(
  '/history',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    type DerivedStatus = 'hit' | 'short' | 'surplus' | 'failed' | 'in_progress';
    const ALL_DERIVED: DerivedStatus[] = ['hit', 'short', 'surplus', 'failed', 'in_progress'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (s: unknown, fallback: Date): Date => {
      if (typeof s !== 'string' || s.length === 0) return fallback;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return fallback;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = parseDate(req.query.from, defaultFrom);
    const to = parseDate(req.query.to, today);
    if (to < from) throw new AppError(400, 'to must be on or after from');

    const productIdFilter = typeof req.query.productId === 'string' && req.query.productId.length > 0
      ? req.query.productId : undefined;
    const statusFilter = typeof req.query.status === 'string' && ALL_DERIVED.includes(req.query.status as DerivedStatus)
      ? (req.query.status as DerivedStatus) : undefined;
    const qFilter = typeof req.query.q === 'string' && req.query.q.trim().length > 0
      ? req.query.q.trim().toLowerCase() : undefined;
    const cursor = parseDate(req.query.cursor, new Date(8640000000000000));
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) ?? '30', 10) || 30, 1),
      90,
    );

    const dayEnd = new Date(to);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [targets, batches] = await Promise.all([
      prisma.dailyProductionTarget.findMany({
        where: {
          targetDate: { gte: from, lt: dayEnd },
          ...(productIdFilter ? { productId: productIdFilter } : {}),
        },
        include: { product: { select: { id: true, name: true } } },
      }),
      prisma.productionBatch.findMany({
        where: {
          startedAt: { gte: from, lt: dayEnd },
          ...(productIdFilter ? { productId: productIdFilter } : {}),
        },
        include: {
          product: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    // Local-date key (avoids UTC drift)
    const dateKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    type Acc = {
      date: string;
      targetByProduct: Map<string, { productName: string; target: number; carryOver: number; shortage: number }>;
      batchesByProduct: Map<string, Array<typeof batches[number]>>;
      productNames: Map<string, string>;
    };
    const byDate = new Map<string, Acc>();
    const ensureDay = (key: string): Acc => {
      const existing = byDate.get(key);
      if (existing) return existing;
      const fresh: Acc = {
        date: key,
        targetByProduct: new Map(),
        batchesByProduct: new Map(),
        productNames: new Map(),
      };
      byDate.set(key, fresh);
      return fresh;
    };

    for (const t of targets) {
      const key = dateKey(new Date(t.targetDate));
      const day = ensureDay(key);
      day.targetByProduct.set(t.productId, {
        productName: t.product.name,
        target: t.targetQty,
        carryOver: t.carriedOverShortage,
        shortage: t.shortage,
      });
      day.productNames.set(t.productId, t.product.name);
    }
    for (const b of batches) {
      const key = dateKey(new Date(b.startedAt));
      const day = ensureDay(key);
      const list = day.batchesByProduct.get(b.productId) ?? [];
      list.push(b);
      day.batchesByProduct.set(b.productId, list);
      day.productNames.set(b.productId, b.product.name);
    }

    type HistoryBatch = {
      id: string;
      batchNumber: string;
      quantityProduced: number;
      status: 'in_progress' | 'completed' | 'failed';
      startedAt: string;
      completedAt: string | null;
      notes: string | null;
      producedBy: { id: string; name: string };
    };
    type HistoryRow = {
      productId: string;
      productName: string;
      target: number;
      carryOver: number;
      actualProduced: number;
      shortage: number;
      derivedStatus: DerivedStatus;
      batches: HistoryBatch[];
    };
    type HistoryDay = {
      date: string;
      batchCount: number;
      totalTarget: number;
      totalProduced: number;
      totalShortage: number;
      totalSurplus: number;
      completionPct: number;
      rows: HistoryRow[];
    };

    const days: HistoryDay[] = [];

    for (const acc of byDate.values()) {
      const productIds = new Set<string>([
        ...acc.targetByProduct.keys(),
        ...acc.batchesByProduct.keys(),
      ]);

      const rows: HistoryRow[] = [];
      let batchCount = 0;

      for (const pid of productIds) {
        const t = acc.targetByProduct.get(pid);
        const productBatches = acc.batchesByProduct.get(pid) ?? [];
        if (productBatches.length === 0 && !t) continue;

        const productName = acc.productNames.get(pid) ?? '—';
        const actualProduced = productBatches
          .filter((b) => b.status !== 'failed')
          .reduce((s, b) => s + b.quantityProduced, 0);
        const target = t?.target ?? 0;
        const carryOver = t?.carryOver ?? 0;
        const shortage = t ? Math.max(0, target - actualProduced) : 0;

        // Multi-batch worst-of rule
        let derivedStatus: DerivedStatus;
        if (productBatches.some((b) => b.status === 'failed')) {
          derivedStatus = 'failed';
        } else if (productBatches.some((b) => b.status === 'in_progress')) {
          derivedStatus = 'in_progress';
        } else if (target === 0) {
          derivedStatus = productBatches.length > 0 ? 'surplus' : 'hit';
        } else if (actualProduced >= target && actualProduced === target) {
          derivedStatus = 'hit';
        } else if (actualProduced > target) {
          derivedStatus = 'surplus';
        } else {
          derivedStatus = 'short';
        }

        const historyBatches: HistoryBatch[] = productBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          quantityProduced: b.quantityProduced,
          status: b.status,
          startedAt: b.startedAt.toISOString(),
          completedAt: b.completedAt ? b.completedAt.toISOString() : null,
          notes: b.notes,
          producedBy: { id: b.user.id, name: b.user.name },
        }));

        rows.push({
          productId: pid,
          productName,
          target,
          carryOver,
          actualProduced,
          shortage,
          derivedStatus,
          batches: historyBatches,
        });

        batchCount += productBatches.length;
      }

      // Skip days with zero batches per spec §3.3
      if (batchCount === 0) continue;

      // Post-filter status
      let filteredRows = statusFilter
        ? rows.filter((r) => r.derivedStatus === statusFilter)
        : rows;

      // Post-filter q (matches product name OR batch number, case-insensitive contains)
      if (qFilter) {
        filteredRows = filteredRows.filter((r) =>
          r.productName.toLowerCase().includes(qFilter) ||
          r.batches.some((b) => b.batchNumber.toLowerCase().includes(qFilter)),
        );
      }

      if (filteredRows.length === 0) continue;

      filteredRows.sort((a, b) => a.productName.localeCompare(b.productName));

      const totalTarget = filteredRows.reduce((s, r) => s + r.target, 0);
      const totalProduced = filteredRows.reduce((s, r) => s + r.actualProduced, 0);
      const totalShortage = Math.max(0, totalTarget - totalProduced);
      const totalSurplus = Math.max(0, totalProduced - totalTarget);
      const completionPct = totalTarget > 0
        ? Math.round((totalProduced / totalTarget) * 100)
        : 100;

      days.push({
        date: acc.date,
        batchCount: filteredRows.reduce((s, r) => s + r.batches.length, 0),
        totalTarget,
        totalProduced,
        totalShortage,
        totalSurplus,
        completionPct,
        rows: filteredRows,
      });
    }

    days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const cursorKey = dateKey(cursor);
    const afterCursor = req.query.cursor
      ? days.filter((d) => d.date < cursorKey)
      : days;

    const paged = afterCursor.slice(0, limit);
    const nextCursor = paged.length === limit && afterCursor.length > limit
      ? paged[paged.length - 1].date
      : null;

    res.json({ days: paged, nextCursor });
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
