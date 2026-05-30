import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// ───────────────────────────── aging helpers ─────────────────────────────

interface AgingBucket { count: number; amount: number; }
interface AgingBuckets {
  bucket_0_30: AgingBucket;
  bucket_31_60: AgingBucket;
  bucket_61_90: AgingBucket;
  bucket_91_180: AgingBucket;
  bucket_181_365: AgingBucket;
  bucket_over_365: AgingBucket;
}

function emptyAgingBuckets(): AgingBuckets {
  const e = (): AgingBucket => ({ count: 0, amount: 0 });
  return {
    bucket_0_30: e(),
    bucket_31_60: e(),
    bucket_61_90: e(),
    bucket_91_180: e(),
    bucket_181_365: e(),
    bucket_over_365: e(),
  };
}

function ageBucketKey(daysOutstanding: number): keyof AgingBuckets {
  if (daysOutstanding <= 30) return 'bucket_0_30';
  if (daysOutstanding <= 60) return 'bucket_31_60';
  if (daysOutstanding <= 90) return 'bucket_61_90';
  if (daysOutstanding <= 180) return 'bucket_91_180';
  if (daysOutstanding <= 365) return 'bucket_181_365';
  return 'bucket_over_365';
}

/**
 * Compute AR aging buckets for the given outstanding orders.
 * Outstanding = status='invoiced' AND balanceDue > 0.
 * Age = days(asOf, completedAt ?? createdAt).
 */
function computeAging(
  orders: Array<{ balanceDue: number; createdAt: Date; completedAt: Date | null }>,
  asOf: Date,
): AgingBuckets {
  const out = emptyAgingBuckets();
  const MS_DAY = 24 * 60 * 60 * 1000;
  for (const o of orders) {
    const anchor = o.completedAt ?? o.createdAt;
    const days = Math.max(0, Math.floor((asOf.getTime() - anchor.getTime()) / MS_DAY));
    const key = ageBucketKey(days);
    out[key].count += 1;
    out[key].amount += o.balanceDue;
  }
  return out;
}

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
              { name: { contains: search } },
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
// Optional query: from, to (ISO datetime). When absent, defaults to last 6 months.
router.get(
  '/analytics',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const defaultSixMonthsAgo = new Date(now);
    defaultSixMonthsAgo.setMonth(now.getMonth() - 5);
    defaultSixMonthsAgo.setDate(1);
    defaultSixMonthsAgo.setHours(0, 0, 0, 0);

    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const rangeFrom = fromParam ? new Date(fromParam) : defaultSixMonthsAgo;
    const rangeTo = toParam ? new Date(toParam) : now;

    // Common where for range-scoped aggregates
    const rangeWhere = {
      status: { not: 'cancelled' as const },
      createdAt: { gte: rangeFrom, lte: rangeTo },
    };

    const [activeCustomers, orderStats, revenueByCustomer, recentCustomerIds, monthlyOrders, topProducts] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      prisma.salesOrder.aggregate({
        where: rangeWhere,
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.salesOrder.groupBy({
        by: ['customerId'],
        where: { ...rangeWhere, customerId: { not: null } },
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
        where: rangeWhere,
        select: { createdAt: true, total: true },
      }),
      prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: { salesOrder: { ...rangeWhere } },
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

    // Build month buckets for every month spanned by [rangeFrom, rangeTo]
    const monthBuckets: Record<string, { orders: number; revenue: number }> = {};
    const cursor = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), 1);
    const stop = new Date(rangeTo.getFullYear(), rangeTo.getMonth(), 1);
    while (cursor <= stop) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets[key] = { orders: 0, revenue: 0 };
      cursor.setMonth(cursor.getMonth() + 1);
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
// Optional query: from, to (ISO datetime), limit (default 10).
router.get(
  '/leaderboard',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    const take = Math.max(1, Math.min(50, Number(limitParam) || 10));

    const dateFilter = fromParam && toParam
      ? { createdAt: { gte: new Date(fromParam), lte: new Date(toParam) } }
      : {};

    // Top customers by total spend in (optional) range
    const result = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        status: { not: 'cancelled' },
        customerId: { not: null },
        ...dateFilter,
      },
      _sum: { total: true, amountPaid: true, balanceDue: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take,
    });

    const customerIds = result.map((r) => r.customerId).filter(Boolean) as string[];
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, creditBalance: true },
    });
    const cMap = new Map(customers.map(c => [c.id, c]));

    // Outstanding (all-time unpaid) for each customer
    const allTimeOutstanding = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { status: 'invoiced', balanceDue: { gt: 0 }, customerId: { in: customerIds } },
      _sum: { balanceDue: true },
    });
    const outstandingMap = new Map(
      allTimeOutstanding.map(o => [o.customerId, o._sum.balanceDue || 0]),
    );

    const enriched = result.map(r => {
      const c = cMap.get(r.customerId!);
      return {
        id: c?.id,
        name: c?.name,
        phone: c?.phone,
        totalSpent: r._sum.total || 0,
        amountPaid: r._sum.amountPaid || 0,
        balanceDueInRange: r._sum.balanceDue || 0,
        outstandingAllTime: outstandingMap.get(r.customerId) || 0,
        totalOrders: r._count.id,
      };
    });

    res.json(enriched);
  }),
);

// GET /api/customers/aging
// Optional query: asOf (ISO datetime). Defaults to now.
// Returns aging buckets summed across all unpaid invoices.
router.get(
  '/aging',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const asOfParam = req.query.asOf as string | undefined;
    const asOf = asOfParam ? new Date(asOfParam) : new Date();

    const outstanding = await prisma.salesOrder.findMany({
      where: { status: 'invoiced', balanceDue: { gt: 0 } },
      select: { balanceDue: true, createdAt: true, completedAt: true },
    });

    const buckets = computeAging(outstanding, asOf);
    const totalOutstanding = outstanding.reduce((sum, o) => sum + o.balanceDue, 0);

    res.json({
      asOf: asOf.toISOString(),
      buckets,
      totalOutstanding,
      totalInvoices: outstanding.length,
    });
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

    // Enrich top products with names (batched query instead of N+1)
    const topProductIds = topProducts.map((tp) => tp.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(productDetails.map((p) => [p.id, p.name]));
    const enrichedProducts = topProducts.map((tp) => ({
      name: productMap.get(tp.productId) ?? 'Unknown',
      quantity: tp._sum.quantity,
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

// GET /api/customers/:id/statement
// Required query: from, to (ISO datetime). Returns orders-in-range + totals
// + aging (this customer, all-time unpaid) + top products bought in range.
router.get(
  '/:id/statement',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const customerId = getParam(req, 'id');
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    if (!fromParam || !toParam) {
      throw new AppError(400, 'from and to query params are required');
    }
    const rangeFrom = new Date(fromParam);
    const rangeTo = new Date(toParam);
    const asOf = new Date();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        creditBalance: true,
        createdAt: true,
      },
    });
    if (!customer) throw new AppError(404, 'Customer not found');

    const [ordersInRange, allUnpaid, topItemsRaw] = await Promise.all([
      // Full orders in range
      prisma.salesOrder.findMany({
        where: {
          customerId,
          status: { not: 'cancelled' },
          createdAt: { gte: rangeFrom, lte: rangeTo },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          completedAt: true,
          status: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
          _count: { select: { items: true } },
        },
      }),
      // All-time unpaid invoices for aging — not range-constrained
      prisma.salesOrder.findMany({
        where: { customerId, status: 'invoiced', balanceDue: { gt: 0 } },
        select: { balanceDue: true, createdAt: true, completedAt: true },
      }),
      // Top products in range (by quantity)
      prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: {
          salesOrder: {
            customerId,
            status: { not: 'cancelled' },
            createdAt: { gte: rangeFrom, lte: rangeTo },
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
    ]);

    // Enrich product names
    const topItemIds = topItemsRaw.map((t) => t.productId);
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topItemIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(productDetails.map((p) => [p.id, p.name]));
    const topProductsInRange = topItemsRaw.map((t) => ({
      name: productMap.get(t.productId) ?? 'Unknown',
      quantity: t._sum.quantity ?? 0,
      revenue: t._sum.total ?? 0,
    }));

    // Compute totals from ordersInRange
    let purchased = 0, paid = 0, outstanding = 0;
    for (const o of ordersInRange) {
      purchased += o.total;
      paid += o.amountPaid;
      outstanding += o.balanceDue;
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        creditBalance: customer.creditBalance,
        customerSince: customer.createdAt.toISOString(),
      },
      range: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
      ordersInRange: ordersInRange.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        completedAt: o.completedAt ? o.completedAt.toISOString() : null,
        status: o.status,
        itemCount: o._count.items,
        total: o.total,
        amountPaid: o.amountPaid,
        balanceDue: o.balanceDue,
      })),
      totals: {
        purchased,
        paid,
        outstanding,
        orderCount: ordersInRange.length,
      },
      aging: computeAging(allUnpaid, asOf),
      topProductsInRange,
    });
  }),
);

export default router;
