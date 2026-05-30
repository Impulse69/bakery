import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { syncProductAvailability } from '../services/products.js';
import { recordAudit } from '../services/audit.js';
import type { SalesOrderStatus } from '@bakery/types';

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
      // Snapshot cost prices for margin / profit reporting
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Compute totals from items
      const computedItems = items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice + item.tax;
        const product = productMap.get(item.productId);
        return {
          ...item,
          total: lineTotal,
          unitCostPrice: product?.costPrice ?? 0,
        };
      });

      const subtotal = computedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const taxTotal = computedItems.reduce((s, i) => s + i.tax, 0);
      const total = subtotal + taxTotal;

      // Assign the next order sequence in-transaction. SQLite has no non-PK
      // autoincrement, so we compute max+1 (safe at single-machine concurrency)
      // and format the human-readable orderNumber up front — no placeholder.
      const seqAgg = await tx.salesOrder.aggregate({ _max: { orderSequence: true } });
      const orderSequence = (seqAgg._max.orderSequence ?? 0) + 1;

      const created = await tx.salesOrder.create({
        data: {
          orderSequence,
          orderNumber: `SO-${String(orderSequence).padStart(4, '0')}`,
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
        include: { items: { include: { product: true } }, customer: true },
      });

      // Verify stock availability and decrement stock for each product
      for (const item of computedItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true, stockQuantity: true },
        });

        if (!product || product.stockQuantity < item.quantity) {
          throw new AppError(
            400,
            `Insufficient stock for "${product?.name || 'Unknown product'}". Available: ${product?.stockQuantity || 0}, Requested: ${item.quantity}`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        await syncProductAvailability(tx, item.productId);
      }

      return created;
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

    const allowed = VALID_TRANSITIONS[order.status as SalesOrderStatus] ?? [];
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

// ─── Sale modification (audited) ─────────────────────────────────────────────
// Cashier can modify ONLY their own orders; admin/owner can modify any.
// Every mutation writes an AuditLog row inside the same transaction so the
// changes are tamper-evident.

const addItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  tax: z.number().int().min(0).optional().default(0),
  reason: z.string().min(1, 'reason is required'),
});

const editItemSchema = z.object({
  quantity: z.number().int().min(1),
  reason: z.string().min(1, 'reason is required'),
});

const removeItemSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});

/** Ensure the caller may modify this order — admin/owner can do any; cashier only their own. */
function authorizeModification(role: string, orderProcessedBy: string, userId: string) {
  if (role === 'admin' || role === 'owner') return;
  if (role === 'cashier' && orderProcessedBy === userId) return;
  throw new AppError(403, 'You can only modify your own sales orders.');
}

/** Recompute subtotal/tax/total/balanceDue on a sales order based on its current items. */
async function recomputeOrderTotals(tx: Parameters<typeof recordAudit>[0], orderId: string) {
  const items = await tx.salesOrderItem.findMany({ where: { salesOrderId: orderId } });
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((s, i) => s + i.tax, 0);
  const total = subtotal + taxTotal;
  const order = await tx.salesOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Sales order not found');
  const balanceDue = Math.max(0, total - order.amountPaid);
  // If a previously-paid order's total grows, the status drops out of 'paid'.
  const nextStatus =
    order.status === 'paid' && balanceDue > 0 ? 'invoiced' : order.status;
  await tx.salesOrder.update({
    where: { id: orderId },
    data: {
      subtotal,
      taxTotal,
      total,
      balanceDue,
      status: nextStatus,
    },
  });
}

// POST /api/sales-orders/:id/items — add a new line item to an existing order
router.post(
  '/:id/items',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const body = addItemSchema.parse(req.body);
    const orderId = getParam(req, 'id');
    const user = req.user!;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new AppError(404, 'Sales order not found');
      if (order.status === 'cancelled') {
        throw new AppError(400, 'Cannot modify a cancelled order');
      }
      authorizeModification(user.role, order.processedBy, user.id);

      const product = await tx.product.findUnique({
        where: { id: body.productId },
        select: { name: true, stockQuantity: true, costPrice: true },
      });
      if (!product) throw new AppError(404, 'Product not found');
      if (product.stockQuantity < body.quantity) {
        throw new AppError(
          400,
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${body.quantity}`,
        );
      }

      const lineTotal = body.quantity * body.unitPrice + body.tax;
      const item = await tx.salesOrderItem.create({
        data: {
          salesOrderId: orderId,
          productId: body.productId,
          variantId: body.variantId ?? null,
          quantity: body.quantity,
          unitPrice: body.unitPrice,
          unitCostPrice: product.costPrice,
          tax: body.tax,
          total: lineTotal,
        },
      });

      await tx.product.update({
        where: { id: body.productId },
        data: { stockQuantity: { decrement: body.quantity } },
      });
      await syncProductAvailability(tx, body.productId);

      await recomputeOrderTotals(tx, orderId);

      await tx.salesOrder.update({
        where: { id: orderId },
        data: { lastModifiedAt: new Date(), lastModifiedBy: user.id },
      });

      await recordAudit(tx, {
        entity: 'sales_order',
        entityId: orderId,
        action: 'item_added',
        userId: user.id,
        reason: body.reason,
        after: { itemId: item.id, productId: body.productId, quantity: body.quantity, unitPrice: body.unitPrice },
      });

      return tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
    });

    getIO().emit('sale:updated', { orderId, action: 'item_added' });
    res.status(201).json(result);
  }),
);

// PATCH /api/sales-orders/:id/items/:itemId — change quantity only
router.patch(
  '/:id/items/:itemId',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const body = editItemSchema.parse(req.body);
    const orderId = getParam(req, 'id');
    const itemId = getParam(req, 'itemId');
    const user = req.user!;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new AppError(404, 'Sales order not found');
      if (order.status === 'cancelled') {
        throw new AppError(400, 'Cannot modify a cancelled order');
      }
      authorizeModification(user.role, order.processedBy, user.id);

      const item = await tx.salesOrderItem.findFirst({
        where: { id: itemId, salesOrderId: orderId },
      });
      if (!item) throw new AppError(404, 'Line item not found on this order');

      const delta = body.quantity - item.quantity;
      if (delta === 0) {
        return tx.salesOrder.findUnique({
          where: { id: orderId },
          include: { items: { include: { product: true } } },
        });
      }

      // delta>0 → need more stock; delta<0 → return stock to inventory.
      if (delta > 0) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true, stockQuantity: true },
        });
        if (!product) throw new AppError(404, 'Product not found');
        if (product.stockQuantity < delta) {
          throw new AppError(
            400,
            `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Additional needed: ${delta}`,
          );
        }
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: delta } },
      });
      await syncProductAvailability(tx, item.productId);

      const newTotal = body.quantity * item.unitPrice + item.tax;
      await tx.salesOrderItem.update({
        where: { id: itemId },
        data: { quantity: body.quantity, total: newTotal },
      });

      await recomputeOrderTotals(tx, orderId);

      await tx.salesOrder.update({
        where: { id: orderId },
        data: { lastModifiedAt: new Date(), lastModifiedBy: user.id },
      });

      await recordAudit(tx, {
        entity: 'sales_order_item',
        entityId: itemId,
        action: 'item_quantity_changed',
        userId: user.id,
        reason: body.reason,
        before: { quantity: item.quantity, total: item.total },
        after: { quantity: body.quantity, total: newTotal },
      });

      return tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
    });

    getIO().emit('sale:updated', { orderId, action: 'item_quantity_changed' });
    res.json(result);
  }),
);

// DELETE /api/sales-orders/:id/items/:itemId — remove a line item
router.delete(
  '/:id/items/:itemId',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    // Accept reason from query (?reason=...) OR body — DELETE bodies aren't
    // universally supported by all HTTP clients.
    const reasonRaw = (req.query.reason as string | undefined) ?? req.body?.reason;
    const body = removeItemSchema.parse({ reason: reasonRaw ?? '' });
    const orderId = getParam(req, 'id');
    const itemId = getParam(req, 'itemId');
    const user = req.user!;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { _count: { select: { items: true } } },
      });
      if (!order) throw new AppError(404, 'Sales order not found');
      if (order.status === 'cancelled') {
        throw new AppError(400, 'Cannot modify a cancelled order');
      }
      authorizeModification(user.role, order.processedBy, user.id);

      const item = await tx.salesOrderItem.findFirst({
        where: { id: itemId, salesOrderId: orderId },
      });
      if (!item) throw new AppError(404, 'Line item not found on this order');
      if (order._count.items <= 1) {
        throw new AppError(
          400,
          'Cannot remove the last line item. Cancel the order instead.',
        );
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      await syncProductAvailability(tx, item.productId);

      await tx.salesOrderItem.delete({ where: { id: itemId } });

      await recomputeOrderTotals(tx, orderId);

      await tx.salesOrder.update({
        where: { id: orderId },
        data: { lastModifiedAt: new Date(), lastModifiedBy: user.id },
      });

      await recordAudit(tx, {
        entity: 'sales_order',
        entityId: orderId,
        action: 'item_removed',
        userId: user.id,
        reason: body.reason,
        before: {
          itemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        },
      });

      return tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
    });

    getIO().emit('sale:updated', { orderId, action: 'item_removed' });
    res.json(result);
  }),
);

export default router;
