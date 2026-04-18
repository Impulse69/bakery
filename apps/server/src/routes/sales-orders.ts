import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import type { SalesOrderStatus } from '@prisma/client';

const router = Router();

const VALID_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['picked', 'cancelled'],
  picked: ['invoiced', 'cancelled'],
  invoiced: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

const createOrderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  tax: z.number().int().min(0).optional().default(0),
});

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  locationId: z.string(),
  items: z.array(createOrderItemSchema).min(1),
  notes: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'picked', 'invoiced', 'paid', 'cancelled']),
});

const paymentSchema = z.object({
  amount: z.number().int().min(1),
  method: z.enum(['cash', 'momo', 'card', 'credit']),
  note: z.string().optional(),
});

// GET /api/sales-orders/today-summary (must be before /:id)
router.get(
  '/today-summary',
  requireRole('admin', 'owner'),
  asyncHandler(async (_req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [orders, topProducts] = await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: { not: 'cancelled' },
        },
      }),
      prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: {
          salesOrder: {
            createdAt: { gte: startOfDay, lte: endOfDay },
            status: { not: 'cancelled' },
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;

    res.json({ totalRevenue, totalOrders, topProducts });
  }),
);

// GET /api/sales-orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const status = req.query.status as SalesOrderStatus | undefined;
    const date = req.query.date as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (date) {
      const day = new Date(date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.createdAt = { gte: day, lt: nextDay };
    }

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: { customer: true, _count: { select: { items: true } } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesOrder.count({ where }),
    ]);
    res.json({ data: orders, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/sales-orders/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.salesOrder.findUnique({
      where: { id: getParam(req, 'id') },
      include: {
        items: { include: { product: true, variant: true } },
        payments: { orderBy: { date: 'desc' } },
        customer: true,
        location: true,
      },
    });
    if (!order) throw new AppError(404, 'Sales order not found');
    res.json(order);
  }),
);

// POST /api/sales-orders
router.post(
  '/',
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const { customerId, locationId, items, notes } = createOrderSchema.parse(req.body);

    const order = await prisma.$transaction(async (tx) => {
      // Lookup wholesale prices for the products
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, wholesalePrice: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Compute totals from items
      const computedItems = items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice + item.tax;
        const product = productMap.get(item.productId);
        return { 
          ...item, 
          total: lineTotal,
          unitWholesalePrice: product?.wholesalePrice ?? 0,
        };
      });

      const subtotal = computedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const taxTotal = computedItems.reduce((s, i) => s + i.tax, 0);
      const total = subtotal + taxTotal;

      // Create with placeholder orderNumber
      const created = await tx.salesOrder.create({
        data: {
          orderNumber: 'TEMP',
          customerId: customerId || null,
          locationId,
          processedBy: req.user!.id,
          subtotal,
          taxTotal,
          total,
          balanceDue: total,
          notes,
          items: {
            create: computedItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Decrement stock for each product and implement Sold Out logic
      for (const item of computedItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          const newStock = product.stockQuantity - item.quantity;
          await tx.product.update({
            where: { id: item.productId },
            data: { 
              stockQuantity: newStock,
              isAvailable: newStock > 0 
            }
          });
        }
      }

      // Update with formatted orderNumber
      return tx.salesOrder.update({
        where: { id: created.id },
        data: {
          orderNumber: `SO-${String(created.orderSequence).padStart(4, '0')}`,
        },
        include: { items: { include: { product: true } }, customer: true },
      });
    });

    getIO().emit('sale:created', { orderId: order.id, total: order.total });
    res.status(201).json(order);
  }),
);

// PATCH /api/sales-orders/:id/status
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status: newStatus } = statusSchema.parse(req.body);

    const order = await prisma.salesOrder.findUnique({ where: { id: getParam(req, 'id') } });
    if (!order) throw new AppError(404, 'Sales order not found');

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new AppError(400, `Cannot transition from ${order.status} to ${newStatus}`);
    }

    const updated = await prisma.salesOrder.update({
      where: { id: getParam(req, 'id') },
      data: {
        status: newStatus,
        completedAt: newStatus === 'paid' ? new Date() : undefined,
      },
    });

    res.json(updated);
  }),
);

// POST /api/sales-orders/:id/payments
router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const { amount, method, note } = paymentSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id: getParam(req, 'id') } });
      if (!order) throw new AppError(404, 'Sales order not found');
      if (order.status === 'cancelled') throw new AppError(400, 'Cannot pay a cancelled order');

      const payment = await tx.payment.create({
        data: { salesOrderId: order.id, amount, method, note },
      });

      const newAmountPaid = order.amountPaid + amount;
      const newBalanceDue = order.total - newAmountPaid;
      const fullyPaid = newBalanceDue <= 0;

      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: Math.max(0, newBalanceDue),
          status: fullyPaid ? 'paid' : undefined,
          completedAt: fullyPaid ? new Date() : undefined,
        },
      });

      return { payment, order: updated };
    });

    getIO().emit('sale:updated', { orderId: result.order.id, amountPaid: result.order.amountPaid });
    res.status(201).json(result);
  }),
);

export default router;
