import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createCountSchema = z.object({
  locationId: z.string(),
});

const updateItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      actualQuantity: z.number(),
    }),
  ),
});

// GET /api/inventory-counts
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [counts, total] = await Promise.all([
      prisma.inventoryCount.findMany({
        include: {
          location: true,
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryCount.count(),
    ]);
    res.json({ data: counts, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/inventory-counts/:id
router.get(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const count = await prisma.inventoryCount.findUnique({
      where: { id: getParam(req, 'id') },
      include: {
        items: { include: { inventoryItem: true } },
        location: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!count) throw new AppError(404, 'Inventory count not found');
    res.json(count);
  }),
);

// POST /api/inventory-counts
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { locationId } = createCountSchema.parse(req.body);

    // Get all inventory items and snapshot their current quantities
    const inventoryItems = await prisma.inventoryItem.findMany();

    const count = await prisma.inventoryCount.create({
      data: {
        locationId,
        createdBy: req.user!.id,
        items: {
          create: inventoryItems.map((item) => ({
            inventoryItemId: item.id,
            expectedQuantity: item.quantityOnHand,
          })),
        },
      },
      include: {
        items: { include: { inventoryItem: true } },
        location: true,
      },
    });

    res.status(201).json(count);
  }),
);

// PATCH /api/inventory-counts/:id
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { items } = updateItemsSchema.parse(req.body);

    const count = await prisma.inventoryCount.findUnique({ where: { id: getParam(req, 'id') } });
    if (!count) throw new AppError(404, 'Inventory count not found');
    if (count.status !== 'in_progress') throw new AppError(400, 'Count is not in progress');

    // Update each count item's actual quantity
    for (const item of items) {
      const countItem = await prisma.inventoryCountItem.findUnique({ where: { id: item.id } });
      if (!countItem) continue;

      await prisma.inventoryCountItem.update({
        where: { id: item.id },
        data: {
          actualQuantity: item.actualQuantity,
          discrepancy: item.actualQuantity - countItem.expectedQuantity,
        },
      });
    }

    const updated = await prisma.inventoryCount.findUnique({
      where: { id: getParam(req, 'id') },
      include: { items: { include: { inventoryItem: true } } },
    });

    res.json(updated);
  }),
);

// POST /api/inventory-counts/:id/complete
router.post(
  '/:id/complete',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { id: getParam(req, 'id') },
        include: { items: true },
      });
      if (!count) throw new AppError(404, 'Inventory count not found');
      if (count.status !== 'in_progress') throw new AppError(400, 'Count is not in progress');

      // Process discrepancies
      for (const item of count.items) {
        if (item.actualQuantity === null) continue;
        const discrepancy = item.actualQuantity - item.expectedQuantity;
        if (discrepancy === 0) continue;

        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: { quantityOnHand: item.actualQuantity },
        });
      }

      return tx.inventoryCount.update({
        where: { id: count.id },
        data: { status: 'completed', completedAt: new Date() },
        include: { items: { include: { inventoryItem: true } } },
      });
    });

    getIO().emit('stock:updated', { reason: 'correction', countId: result.id });
    res.json(result);
  }),
);

export default router;
