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
  isActive: z.boolean().optional(),
  creditBalance: z.number().int().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

// GET /api/customers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const search = req.query.search as string | undefined;

    const where = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: customers, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/customers/analytics
router.get(
  '/analytics',
  requireRole('admin', 'owner'),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [activeCustomers, orderStats, revenueByCustomer, recentCustomerIds, monthlyOrders, topProducts] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      prisma.salesOrder.aggregate({
        where: { status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.salesOrder.groupBy({
        by: ['customerId'],
        where: { status: { not: 'cancelled' }, customerId: { not: null } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      prisma.salesOrder.findMany({
        where: { status: { not: 'cancelled' }, createdAt: { gte: thirtyDaysAgo }, customerId: { not: null } },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
      prisma.salesOrder.findMany({
        where: { status: { not: 'cancelled' }, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, total: true },
      }),
      prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: { salesOrder: { status: { not: 'cancelled' } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
    ]);

    const topCustomerIds = revenueByCustomer.map((r) => r.customerId!).filter(Boolean);
    const topCustomers = await prisma.customer.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, name: true },
    });
    const custMap = new Map(topCustomers.map((c) => [c.id, c.name]));
    const revenueShare = revenueByCustomer.map((r) => ({
      name: custMap.get(r.customerId!) ?? 'Unknown',
      revenue: r._sum.total ?? 0,
    }));

    const productIds = topProducts.map((p) => p.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const prodMap = new Map(productDetails.map((p) => [p.id, p.name]));
    const topProductsResult = topProducts.map((p) => ({
      name: prodMap.get(p.productId) ?? 'Unknown',
      quantity: p._sum.quantity ?? 0,
    }));

    const monthBuckets: Record<string, { orders: number; revenue: number }> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(sixMonthsAgo.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets[key] = { orders: 0, revenue: 0 };
    }
    for (const o of monthlyOrders) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets[key]) {
        monthBuckets[key].orders += 1;
        monthBuckets[key].revenue += o.total;
      }
    }
    const ordersPerMonth = Object.entries(monthBuckets).map(([period, v]) => ({ period, ...v }));

    const totalOrders = orderStats._count.id;
    const totalRevenue = orderStats._sum.total ?? 0;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const active30d = recentCustomerIds.length;
    const churned = Math.max(0, activeCustomers - active30d);

    res.json({
      summary: {
        activeCustomers,
        avgOrderValue,
        active30d,
        churned,
      },
      revenueShare,
      ordersPerMonth,
      topProducts: topProductsResult,
    });
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
          include: { payments: true },
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

// DELETE /api/customers/:id (Soft delete)
router.delete(
  '/:id',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.update({
      where: { id: getParam(req, 'id') },
      data: { isActive: false },
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
    const now = new Date();
    
    // Date boundaries
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [stats, orders, periodic, topProducts] = await Promise.all([
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
      // Periodic stats
      Promise.all([
        prisma.salesOrder.aggregate({ where: { customerId, createdAt: { gte: startOfDay }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.salesOrder.aggregate({ where: { customerId, createdAt: { gte: startOfWeek }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.salesOrder.aggregate({ where: { customerId, createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.salesOrder.aggregate({ where: { customerId, createdAt: { gte: startOfQuarter }, status: { not: 'cancelled' } }, _sum: { total: true } }),
        prisma.salesOrder.aggregate({ where: { customerId, createdAt: { gte: startOfYear }, status: { not: 'cancelled' } }, _sum: { total: true } }),
      ]),
      // Top reordered products
      prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: { salesOrder: { customerId, status: { not: 'cancelled' } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
      })
    ]);

    // Enrich top products with names
    const enrichedProducts = await Promise.all(topProducts.map(async (tp) => {
      const p = await prisma.product.findUnique({ where: { id: tp.productId }, select: { name: true } });
      return { name: p?.name, quantity: tp._sum.quantity };
    }));

    // Compute week-streak: consecutive ISO weeks (Mon–Sun) with ≥1 order
    const weekKeys = new Set(
      orders.map((o) => {
        const d = new Date(o.createdAt);
        const day = d.getDay() === 0 ? 7 : d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day - 1));
        return mon.toISOString().split('T')[0];
      }),
    );

    let weekStreak = 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const thisMon = new Date(startOfWeek);

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
      periodic: {
        daily: periodic[0]._sum.total || 0,
        weekly: periodic[1]._sum.total || 0,
        monthly: periodic[2]._sum.total || 0,
        quarterly: periodic[3]._sum.total || 0,
        yearly: periodic[4]._sum.total || 0,
      },
      topProducts: enrichedProducts,
    });
  }),
);

export default router;
