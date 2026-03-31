import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  creditBalance: z.number().int().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

// GET /api/customers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const search = req.query.search as string | undefined;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: customers, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/customers/leaderboard
router.get(
  '/leaderboard',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    // Top 10 customers by total spend
    const result = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { not: 'cancelled' },
        customerId: { not: null },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    const customerIds = result.map((r) => r.customerId).filter(Boolean) as string[];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    });
    const cMap = new Map(customers.map(c => [c.id, c]));

    const enriched = result.map(r => ({
      ...cMap.get(r.customerId!),
      totalSpent: r._sum.total || 0,
      totalOrders: r._count.id,
    }));

    res.json(enriched);
  }),
);

// GET /api/customers/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: getParam(req, 'id') },
      include: {
        salesOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    res.json(customer);
  }),
);

// POST /api/customers
router.post(
  '/',
  requireRole('admin', 'cashier'),
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data });
    res.status(201).json(customer);
  }),
);

// PATCH /api/customers/:id
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateCustomerSchema.parse(req.body);
    const customer = await prisma.customer.update({
      where: { id: getParam(req, 'id') },
      data,
    });
    res.json(customer);
  }),
);

// GET /api/customers/:id/stats
router.get(
  '/:id/stats',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const customerId = getParam(req, 'id');
    const [stats, orders] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: { customerId, status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      prisma.salesOrder.findMany({
        where: { customerId, status: { not: 'cancelled' } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Compute week-streak: consecutive ISO weeks (Mon–Sun) with ≥1 order
    const weekKeys = new Set(
      orders.map((o) => {
        const d = new Date(o.createdAt);
        // ISO week start = Monday
        const day = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon … 7=Sun
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day - 1));
        return mon.toISOString().split('T')[0];
      }),
    );

    let weekStreak = 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    // Walk backwards from the current week
    const now = new Date();
    const todayDay = now.getDay() === 0 ? 7 : now.getDay();
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate() - (todayDay - 1));
    thisMon.setHours(0, 0, 0, 0);

    let cursor = new Date(thisMon);
    while (true) {
      const key = cursor.toISOString().split('T')[0];
      if (!weekKeys.has(key)) break;
      weekStreak++;
      cursor = new Date(cursor.getTime() - MS_WEEK);
    }

    res.json({
      totalSpent: stats._sum.total || 0,
      totalOrders: stats._count.id,
      lastOrderDate: stats._max.createdAt,
      weekStreak,
    });
  }),
);

export default router;
