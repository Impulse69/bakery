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

// DELETE /api/products/:id (soft delete)
router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await prisma.product.update({
      where: { id: getParam(req, 'id') },
      data: { isAvailable: false },
    });
    res.json({ message: 'Product deactivated' });
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
