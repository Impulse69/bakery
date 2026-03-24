import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import type { PurchaseOrderStatus } from '@prisma/client';

const router = Router();

const VALID_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

const lineItemSchema = z.object({
  inventoryItemId: z.string(),
  quantityOrdered: z.number().positive(),
  unit: z.string().min(1),
  unitCost: z.number().int().min(0),
});

const createPOSchema = z.object({
  supplierId: z.string(),
  expectedDeliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

const statusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'received', 'cancelled']),
});

// GET /api/purchase-orders
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const status = req.query.status as PurchaseOrderStatus | undefined;
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, _count: { select: { items: true } } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    res.json({ data: orders, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// POST /api/purchase-orders
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { supplierId, expectedDeliveryDate, notes, items } = createPOSchema.parse(req.body);

    const po = await prisma.$transaction(async (tx) => {
      const computedItems = items.map((item) => ({
        ...item,
        lineTotal: Math.round(item.quantityOrdered * item.unitCost),
      }));
      const totalAmount = computedItems.reduce((s, i) => s + i.lineTotal, 0);

      const created = await tx.purchaseOrder.create({
        data: {
          poNumber: 'TEMP',
          supplierId,
          totalAmount,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          notes,
          createdBy: req.user!.id,
          items: { create: computedItems },
        },
        include: { items: true },
      });

      return tx.purchaseOrder.update({
        where: { id: created.id },
        data: {
          poNumber: `PO-${String(created.poSequence).padStart(4, '0')}`,
        },
        include: { items: true, supplier: true },
      });
    });

    res.status(201).json(po);
  }),
);

// PATCH /api/purchase-orders/:id/status
router.patch(
  '/:id/status',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status: newStatus } = statusSchema.parse(req.body);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: getParam(req, 'id') },
      include: { items: true },
    });
    if (!po) throw new AppError(404, 'Purchase order not found');

    const allowed = VALID_TRANSITIONS[po.status];
    if (!allowed.includes(newStatus)) {
      throw new AppError(400, `Cannot transition from ${po.status} to ${newStatus}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // On received: add stock for each line item
      if (newStatus === 'received') {
        for (const item of po.items) {
          await tx.stockAdjustment.create({
            data: {
              inventoryItemId: item.inventoryItemId,
              quantityChange: item.quantityOrdered,
              adjustmentType: 'purchase',
              referenceId: po.id,
              notes: `PO ${po.poNumber} received`,
              createdBy: req.user!.id,
            },
          });

          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantityOnHand: { increment: item.quantityOrdered } },
          });

          await tx.purchaseOrderLineItem.update({
            where: { id: item.id },
            data: { quantityReceived: item.quantityOrdered },
          });
        }
      }

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: newStatus,
          receivedDate: newStatus === 'received' ? new Date() : undefined,
        },
        include: { items: true, supplier: true },
      });
    });

    if (newStatus === 'received') {
      getIO().emit('stock:updated', { reason: 'purchase', poId: po.id });
    }

    res.json(updated);
  }),
);

export default router;
