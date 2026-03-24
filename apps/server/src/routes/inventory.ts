import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { getIO } from '../lib/socket.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantityOnHand: z.number().optional(),
  lowStockThreshold: z.number().optional(),
  reorderQuantity: z.number().optional(),
});

const updateItemSchema = createItemSchema.partial();

const adjustSchema = z.object({
  quantityChange: z.number(),
  reason: z.string().min(1),
});

// GET /api/inventory
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({ skip, take, orderBy: { name: 'asc' } }),
      prisma.inventoryItem.count(),
    ]);
    res.json({ data: items, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/inventory/low-stock
router.get(
  '/low-stock',
  asyncHandler(async (_req, res) => {
    const items = await prisma.$queryRaw`
      SELECT * FROM inventory_items
      WHERE "quantityOnHand" <= "lowStockThreshold"
      ORDER BY "quantityOnHand" ASC
    `;
    res.json(items);
  }),
);

// POST /api/inventory
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createItemSchema.parse(req.body);
    const item = await prisma.inventoryItem.create({ data });
    res.status(201).json(item);
  }),
);

// PATCH /api/inventory/:id
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateItemSchema.parse(req.body);
    const item = await prisma.inventoryItem.update({
      where: { id: getParam(req, 'id') },
      data,
    });
    res.json(item);
  }),
);

// POST /api/inventory/:id/adjust
router.post(
  '/:id/adjust',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { quantityChange, reason } = adjustSchema.parse(req.body);
    const itemId = getParam(req, 'id');

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) throw new AppError(404, 'Inventory item not found');

      await tx.stockAdjustment.create({
        data: {
          inventoryItemId: itemId,
          quantityChange,
          adjustmentType: 'correction',
          notes: reason,
          createdBy: req.user!.id,
        },
      });

      return tx.inventoryItem.update({
        where: { id: itemId },
        data: { quantityOnHand: { increment: quantityChange } },
      });
    });

    getIO().emit('stock:updated', { itemId, quantityOnHand: result.quantityOnHand });
    res.json(result);
  }),
);

export default router;
