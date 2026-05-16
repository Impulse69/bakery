import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createExpenseSchema = z.object({
  category: z.enum(['utilities', 'wages', 'packaging', 'ingredients', 'maintenance', 'other']),
  description: z.string().min(1),
  amount: z.number().int().min(1),
  paymentMethod: z.enum(['cash', 'momo', 'card', 'credit']),
  expenseDate: z.string().datetime(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

const CATEGORY_VALUES = ['utilities', 'wages', 'packaging', 'ingredients', 'maintenance', 'other'] as const;
type ExpenseCategoryValue = (typeof CATEGORY_VALUES)[number];

function isValidCategory(v: unknown): v is ExpenseCategoryValue {
  return typeof v === 'string' && (CATEGORY_VALUES as readonly string[]).includes(v);
}

// GET /api/expenses
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const category = req.query.category as string | undefined;

    const where: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.expenseDate = dateFilter;
    }
    if (category && isValidCategory(category)) {
      where.category = category;
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        skip,
        take,
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);
    res.json({ data: expenses, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/expenses/summary  — aggregate spend grouped by category over a date range.
// Used by the Expenses page category cards. Accepts ?from=ISO&to=ISO (optional).
router.get(
  '/summary',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const where: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.expenseDate = dateFilter;
    }

    const grouped = await prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });

    const totalsByCategory = new Map<string, { total: number; count: number }>();
    for (const row of grouped) {
      totalsByCategory.set(row.category, {
        total: row._sum.amount ?? 0,
        count: row._count._all,
      });
    }

    const grandTotal = Array.from(totalsByCategory.values()).reduce((s, v) => s + v.total, 0);

    // Emit one entry per known category so the UI can render a stable card grid
    // even when a category has zero spend in the range.
    const categories = CATEGORY_VALUES.map((cat) => {
      const entry = totalsByCategory.get(cat) ?? { total: 0, count: 0 };
      const percentOfTotal = grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0;
      return {
        category: cat,
        total: entry.total,
        count: entry.count,
        percentOfTotal: Math.round(percentOfTotal * 10) / 10,
      };
    });

    res.json({
      from: from ?? null,
      to: to ?? null,
      total: grandTotal,
      categories,
    });
  }),
);

// POST /api/expenses
router.post(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const data = createExpenseSchema.parse(req.body);

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          ...data,
          expenseDate: new Date(data.expenseDate),
          expenseNumber: 'TEMP',
          recordedBy: req.user!.id,
        },
      });

      return tx.expense.update({
        where: { id: created.id },
        data: {
          expenseNumber: `EX-${String(created.expenseSequence).padStart(4, '0')}`,
        },
      });
    });

    res.status(201).json(expense);
  }),
);

const updateExpenseSchema = z.object({
  category: z.enum(['utilities', 'wages', 'packaging', 'ingredients', 'maintenance', 'other']).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().int().min(1).optional(),
  paymentMethod: z.enum(['cash', 'momo', 'card', 'credit']).optional(),
  expenseDate: z.string().datetime().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

// PATCH /api/expenses/:id
router.patch(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    const data = updateExpenseSchema.parse(req.body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.expenseDate) {
      updateData.expenseDate = new Date(data.expenseDate);
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
    });
    res.json(expense);
  }),
);

// DELETE /api/expenses/:id
router.delete(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const id = getParam(req, 'id');
    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  }),
);

export default router;
