import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { syncProductAvailability } from '../services/products.js';

const router = Router();

// Accepts both the new (sellingPrice/costPrice) and legacy (price/wholesalePrice)
// field names so the cutover doesn't break in-flight clients.
const createProductSchema = z
  .object({
    name: z.string().min(1),
    sku: z.string().min(1).optional(),
    category: z.string().min(1),
    sellingPrice: z.number().int().min(0).optional(),
    costPrice: z.number().int().min(0).optional(),
    // Legacy aliases.
    price: z.number().int().min(0).optional(),
    wholesalePrice: z.number().int().min(0).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.sellingPrice != null || d.price != null, {
    message: 'sellingPrice (or legacy price) is required',
    path: ['sellingPrice'],
  });

/** Generate a human-readable SKU like "BRE-001" from category + sequence.
 *  Retries with random suffix on (rare) uniqueness collision. */
async function generateSku(category: string): Promise<string> {
  const prefix = category.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'PRD';
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.product.count({ where: { category } });
    const seq = String(count + 1 + attempt).padStart(3, '0');
    const candidate = `${prefix}-${seq}`;
    const exists = await prisma.product.findUnique({ where: { sku: candidate } });
    if (!exists) return candidate;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  sellingPrice: z.number().int().min(0).optional(),
  costPrice: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  wholesalePrice: z.number().int().min(0).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

/** Normalize legacy price field names to the canonical sellingPrice/costPrice. */
function normalizePriceFields<T extends {
  sellingPrice?: number;
  costPrice?: number;
  price?: number;
  wholesalePrice?: number;
}>(data: T): Omit<T, 'price' | 'wholesalePrice'> & { sellingPrice?: number; costPrice?: number } {
  const { price, wholesalePrice, sellingPrice, costPrice, ...rest } = data;
  const out: Record<string, unknown> = { ...rest };
  const sp = sellingPrice ?? price;
  const cp = costPrice ?? wholesalePrice;
  if (sp != null) out.sellingPrice = sp;
  if (cp != null) out.costPrice = cp;
  return out as Omit<T, 'price' | 'wholesalePrice'> & { sellingPrice?: number; costPrice?: number };
}

const adjustStockSchema = z.object({
  quantityChange: z.number(),
  reason: z.string().min(1),
});

// GET /api/products
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const where = includeInactive ? {} : { isActive: true };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: { where: { isActive: true } } },
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
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
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const parsed = createProductSchema.parse(req.body);
    const data = normalizePriceFields(parsed);
    const sku = parsed.sku && parsed.sku.trim().length > 0
      ? parsed.sku.trim()
      : await generateSku(parsed.category);
    if (data.sellingPrice == null) {
      throw new AppError(400, 'sellingPrice is required');
    }
    const product = await prisma.product.create({
      data: {
        name: parsed.name,
        sku,
        category: parsed.category,
        description: parsed.description,
        isActive: parsed.isActive,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice ?? 0,
      },
    });
    res.status(201).json(product);
  }),
);

// PATCH /api/products/:id
router.patch(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const parsed = updateProductSchema.parse(req.body);
    const data = normalizePriceFields(parsed);
    const productId = getParam(req, 'id');
    const product = await prisma.product.update({
      where: { id: productId },
      data,
    });

    if (data.isActive !== undefined) {
      await prisma.$transaction(async (tx) => {
        if (data.isActive === false) {
          await tx.product.update({
            where: { id: productId },
            data: { isAvailable: false },
          });
        } else {
          await syncProductAvailability(tx, productId);
        }
      });
    }

    res.json(product);
  }),
);

// DELETE /api/products/:id  (soft delete by default; ?permanent=true removes the row)
router.delete(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const permanent = req.query.permanent === 'true' || req.query.permanent === '1';

    if (!permanent) {
      await prisma.product.update({ where: { id }, data: { isActive: false, isAvailable: false } });
      res.json({ message: 'Product deactivated' });
      return;
    }

    // Destructive cascade: remove the product and every record that references it,
    // including the parent SalesOrder rows it appeared on.
    await prisma.$transaction(async (tx) => {
      const salesOrderIds = (
        await tx.salesOrderItem.findMany({
          where: { productId: id },
          select: { salesOrderId: true },
          distinct: ['salesOrderId'],
        })
      ).map((r) => r.salesOrderId);

      // Deleting the parent orders cascades to their items and payments.
      if (salesOrderIds.length > 0) {
        await tx.salesOrder.deleteMany({ where: { id: { in: salesOrderIds } } });
      }

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
  requireRole('admin', 'owner'),
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
