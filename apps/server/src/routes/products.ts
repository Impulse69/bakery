import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { syncProductAvailability } from '../services/products.js';

const router = Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().min(1),
  price: z.number().int().min(0),
  wholesalePrice: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

const updateProductSchema = createProductSchema.partial();

const adjustStockSchema = z.object({
  quantityChange: z.number(),
  reason: z.string().min(1),
});

// GET /api/products
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        include: { variants: { where: { isActive: true } } },
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count(),
    ]);
    res.json({ data: products, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/products/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: getParam(req, 'id') },
      include: { variants: true },
    });
    if (!product) throw new AppError(404, 'Product not found');
    res.json(product);
  }),
);

// POST /api/products
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  }),
);

// PATCH /api/products/:id
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateProductSchema.parse(req.body);
    const product = await prisma.product.update({
      where: { id: getParam(req, 'id') },
      data,
    });
    res.json(product);
  }),
);

// DELETE /api/products/:id  (soft delete by default; ?permanent=true removes the row)
router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const permanent = req.query.permanent === 'true' || req.query.permanent === '1';

    if (!permanent) {
      await prisma.product.update({ where: { id }, data: { isAvailable: false } });
      res.json({ message: 'Product deactivated' });
      return;
    }

    // Refuse permanent delete when the product is referenced by historical
    // business records we should never silently rewrite.
    const [orderItems, poItems] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: id } }),
      prisma.purchaseOrderLineItem.count({ where: { productId: id } }),
    ]);
    if (orderItems > 0 || poItems > 0) {
      const where: string[] = [];
      if (orderItems > 0) where.push(`${orderItems} sales order line(s)`);
      if (poItems > 0) where.push(`${poItems} purchase order line(s)`);
      throw new AppError(
        409,
        `Cannot permanently delete: product appears on ${where.join(' and ')}. Deactivate it to keep the history intact.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.productStockAdjustment.deleteMany({ where: { productId: id } });
      await tx.dailyProductionTarget.deleteMany({ where: { productId: id } });
      await tx.productionBatch.deleteMany({ where: { productId: id } });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    res.json({ message: 'Product permanently deleted' });
  }),
);

// POST /api/products/:id/adjust-stock
router.post(
  '/:id/adjust-stock',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { quantityChange, reason } = adjustStockSchema.parse(req.body);
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

    res.json(result);
  }),
);

export default router;
