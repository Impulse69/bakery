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

const liquidateSchema = z.object({
  reason: z.string().min(1).max(200),
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
      where: { stockQuantity: { lte: 20 } },
      orderBy: { stockQuantity: 'asc' },
      take: 20,
    });
    
    console.log(`[Inventory] Found ${products.length} low stock items`);
    
    const lowStockItems = products.map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit || 'pcs',
      quantityOnHand: p.stockQuantity,
      lowStockThreshold: 20,
    }));
    
    res.json(lowStockItems);
  }),
);

// GET /api/inventory/value
// Total selling-price value of every unit currently in stock, plus a
// per-product breakdown so the desktop can build a "today's sellable" hint.
router.get(
  '/value',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { isActive: true, stockQuantity: { gt: 0 } },
      select: {
        id: true,
        name: true,
        unit: true,
        stockQuantity: true,
        sellingPrice: true,
        costPrice: true,
      },
      orderBy: { name: 'asc' },
    });

    let totalValue = 0;
    let totalCostValue = 0;
    let totalUnits = 0;
    const breakdown = products.map((p) => {
      const qty = p.stockQuantity;
      const lineValue = Math.round(qty * p.sellingPrice);
      const lineCost = Math.round(qty * (p.costPrice ?? 0));
      totalValue += lineValue;
      totalCostValue += lineCost;
      totalUnits += qty;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit || 'pcs',
        quantityOnHand: qty,
        sellingPrice: p.sellingPrice,
        lineValue,
      };
    });

    res.json({
      totalValue,
      totalCostValue,
      totalUnits,
      productCount: products.length,
      breakdown,
    });
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

// POST /api/inventory/liquidate
// Bread expires fast — at end of day (or whenever shelf life lapses) the admin
// writes off remaining stock in one stroke. We record a negative adjustment
// per product so the loss flows into stock history and cost-basis reports,
// then zero out every product's stockQuantity in a single transaction.
//
// Declared BEFORE `/:id/adjust` so Express never tries to interpret
// "liquidate" as a product id under any future route shape.
router.post(
  '/liquidate',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { reason } = liquidateSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const inStock = await tx.product.findMany({
        where: { stockQuantity: { gt: 0 } },
        select: { id: true, stockQuantity: true, costPrice: true },
      });

      if (inStock.length === 0) {
        return { productsAffected: 0, unitsWrittenOff: 0, costWrittenOff: 0, affectedIds: [] as string[] };
      }

      // One adjustment row per product = trail in /reports/stock-adjustment.
      await tx.productStockAdjustment.createMany({
        data: inStock.map((p) => ({
          productId: p.id,
          quantityChange: -p.stockQuantity,
          reason,
        })),
      });

      // Zero everything in one update — safe because we filtered to qty>0.
      await tx.product.updateMany({
        where: { stockQuantity: { gt: 0 } },
        data: { stockQuantity: 0, isAvailable: false },
      });

      const unitsWrittenOff = inStock.reduce((s, p) => s + p.stockQuantity, 0);
      const costWrittenOff = inStock.reduce(
        (s, p) => s + Math.round(p.stockQuantity * (p.costPrice ?? 0)),
        0,
      );

      return {
        productsAffected: inStock.length,
        unitsWrittenOff,
        costWrittenOff,
        affectedIds: inStock.map((p) => p.id),
      };
    });

    // Tell every connected client to refresh — one event covers all products.
    getIO().emit('inventory:update', { liquidated: true });

    res.json(result);
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
