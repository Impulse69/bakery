import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { getIO } from '../lib/socket.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { syncProductAvailability } from '../services/products.js';

const router = Router();

const adjustSchema = z.object({
  quantityChange: z.number(),
  reason: z.string().min(1),
});

// GET /api/inventory  — paginated product list with stock
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [products, total] = await Promise.all([
      prisma.product.findMany({ skip, take, orderBy: { name: 'asc' } }),
      prisma.product.count(),
    ]);
    res.json({ data: products, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/inventory/low-stock
router.get(
  '/low-stock',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { stockQuantity: { lte: 20 }, isActive: true },
      orderBy: { stockQuantity: 'asc' },
      take: 10,
    });
    
    const lowStockItems = products.map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit || 'pcs',
      quantityOnHand: p.stockQuantity,
      lowStockThreshold: 20, // Default threshold since it's not in the DB yet
    }));
    
    res.json(lowStockItems);
  }),
);

// GET /api/inventory/sold-out
router.get(
  '/sold-out',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { stockQuantity: { lte: 0 } },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  }),
);

// POST /api/inventory/:id/adjust
router.post(
  '/:id/adjust',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { quantityChange, reason } = adjustSchema.parse(req.body);
    const productId = getParam(req, 'id');

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError(404, 'Product not found');

      await tx.productStockAdjustment.create({
        data: { productId, quantityChange, reason },
      });

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: quantityChange } },
      });

      await syncProductAvailability(tx, productId);

      return updated;
    });

    getIO().emit('inventory:update', { productId, stockQuantity: result.stockQuantity });

    res.json(result);
  }),
);

export default router;
