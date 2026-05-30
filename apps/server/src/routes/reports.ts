import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────
// Aggregation helpers (database-agnostic — Prisma + JS reducers).
//
// These replace the previous raw Postgres SQL (date_trunc, ::bigint casts)
// so the same code runs on SQLite (offline single-machine build) and Postgres.
// On a single bakery's data volume the JS-side reduce is imperceptible.
// ──────────────────────────────────────────────────────────────────────────

const NOT_CANCELLED = { not: 'cancelled' } as const;

/** Sum of (unitPrice − wholesaleCost) × qty across all items of matching orders. */
async function marginalProfitForOrders(orderWhere: Prisma.SalesOrderWhereInput): Promise<number> {
  const items = await prisma.salesOrderItem.findMany({
    where: { salesOrder: orderWhere },
    select: { unitPrice: true, unitCostPrice: true, quantity: true },
  });
  return items.reduce(
    (sum, i) => sum + (i.unitPrice - (i.unitCostPrice ?? 0)) * i.quantity,
    0,
  );
}

/** UTC YYYY-MM-DD key (matches the previous date_trunc('day') in UTC). */
function utcDayKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Local YYYY-MM-DD key (matches the local cursor used by the summary trend). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/reports/daily?date=YYYY-MM-DD
router.get(
  '/daily',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date as string | undefined;
    if (!dateStr) throw new AppError(400, 'date query parameter is required');

    const day = new Date(dateStr);
    const nextDay = new Date(dateStr);
    nextDay.setDate(nextDay.getDate() + 1);

    const orderWhere: Prisma.SalesOrderWhereInput = {
      createdAt: { gte: day, lt: nextDay },
      status: NOT_CANCELLED,
    };

    const [orderAgg, expenseAgg, totalMarginalProfit] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: orderWhere,
        _count: { _all: true },
        _sum: { total: true, taxTotal: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: day, lt: nextDay } },
        _sum: { amount: true },
      }),
      marginalProfitForOrders(orderWhere),
    ]);

    const totalRevenue = orderAgg._sum.total ?? 0;
    const totalTax = orderAgg._sum.taxTotal ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      date: dateStr,
      totalOrders: orderAgg._count._all,
      totalRevenue,
      totalTax,
      totalExpenses,
      marginalProfit: totalMarginalProfit,
      netProfit,
    });
  }),
);

// GET /api/reports/summary?from=&to=
// Range-aware operational summary: KPI totals + per-day revenue/orders trend.
// Powers the new Reports > Operations tab.
router.get(
  '/summary',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    if (!fromParam || !toParam) {
      throw new AppError(400, 'from and to query params are required');
    }
    const rangeFrom = new Date(fromParam);
    const rangeTo = new Date(toParam);

    const orderWhere: Prisma.SalesOrderWhereInput = {
      createdAt: { gte: rangeFrom, lte: rangeTo },
      status: NOT_CANCELLED,
    };

    const [orderAgg, expenseAgg, totalMarginalProfit, trendOrders] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: orderWhere,
        _count: { _all: true },
        _sum: { total: true, taxTotal: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amount: true },
      }),
      marginalProfitForOrders(orderWhere),
      prisma.salesOrder.findMany({
        where: orderWhere,
        select: { createdAt: true, total: true },
      }),
    ]);

    const totalRevenue = orderAgg._sum.total ?? 0;
    const totalTax = orderAgg._sum.taxTotal ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (totalMarginalProfit / totalRevenue) * 100 : 0;

    // Bucket orders into per-day revenue/orders (local day key, matching the cursor).
    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of trendOrders) {
      const key = localDayKey(o.createdAt);
      const bucket = trendMap.get(key) ?? { revenue: 0, orders: 0 };
      bucket.revenue += o.total;
      bucket.orders += 1;
      trendMap.set(key, bucket);
    }

    // Build a complete per-day series (fill missing days with zeros) so the
    // frontend chart axis stays contiguous across the range.
    const dailyTrend: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate());
    const stop = new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate());
    while (cursor <= stop) {
      const key = localDayKey(cursor);
      const bucket = trendMap.get(key) ?? { revenue: 0, orders: 0 };
      dailyTrend.push({ date: key, revenue: bucket.revenue, orders: bucket.orders });
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({
      range: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
      totals: {
        orders: orderAgg._count._all,
        revenue: totalRevenue,
        tax: totalTax,
        expenses: totalExpenses,
        marginalProfit: totalMarginalProfit,
        netProfit,
        margin,
      },
      dailyTrend,
    });
  }),
);

// GET /api/reports/profit-analysis?from=&to=
router.get(
  '/profit-analysis',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string | undefined>;
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date('9999-12-31');

    const items = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: { status: NOT_CANCELLED, createdAt: { gte: fromDate, lte: toDate } },
      },
      select: {
        productId: true,
        quantity: true,
        total: true,
        unitCostPrice: true,
        product: { select: { name: true, sku: true } },
      },
    });

    const byProduct = new Map<
      string,
      { productName: string; sku: string | null; quantity: number; revenue: number; cost: number }
    >();
    for (const i of items) {
      const acc = byProduct.get(i.productId) ?? {
        productName: i.product?.name ?? 'Unknown',
        sku: i.product?.sku ?? null,
        quantity: 0,
        revenue: 0,
        cost: 0,
      };
      acc.quantity += i.quantity;
      acc.revenue += i.total;
      acc.cost += (i.unitCostPrice ?? 0) * i.quantity;
      byProduct.set(i.productId, acc);
    }

    const rows = Array.from(byProduct.values())
      .map((r) => ({
        productName: r.productName,
        sku: r.sku,
        quantity: r.quantity,
        revenue: r.revenue,
        cost: r.cost,
        profit: r.revenue - r.cost,
      }))
      .sort((a, b) => b.profit - a.profit);

    res.json(rows);
  }),
);

// GET /api/reports/weekly?endDate=YYYY-MM-DD
router.get(
  '/weekly',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const endDateStr = req.query.endDate as string | undefined;
    if (!endDateStr) throw new AppError(400, 'endDate query parameter is required');

    // Parse date as YYYY-MM-DD to avoid timezone shifts
    const parts = endDateStr.split('-').map(Number);
    if (parts.length !== 3) throw new AppError(400, 'Invalid date format');

    // Create UTC date at noon to be extremely safe about day boundaries
    const endDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));

    // Calculate the most recent Sunday
    const dayOfWeek = endDate.getUTCDay(); // 0 = Sunday
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - dayOfWeek);
    startDate.setUTCHours(0, 0, 0, 0);

    const nextDay = new Date(startDate);
    nextDay.setUTCDate(startDate.getUTCDate() + 7);

    logger.debug({ startDate: startDate.toISOString() }, 'Generating weekly report');

    const orders = await prisma.salesOrder.findMany({
      where: {
        createdAt: { gte: startDate, lt: nextDay },
        status: NOT_CANCELLED,
      },
      select: { createdAt: true, total: true },
    });

    const revenueByDate = new Map<string, number>();
    for (const o of orders) {
      const key = utcDayKey(o.createdAt);
      revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + o.total);
    }

    const results: { date: string; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      const key = utcDayKey(d);
      results.push({ date: key, revenue: revenueByDate.get(key) ?? 0 });
    }

    res.json(results);
  }),
);

// GET /api/reports/stock-adjustment?productId=&from=&to=
// productId is OPTIONAL — when absent, returns adjustments across all products
// (capped at 200 most recent rows). When present, behaviour is unchanged.
router.get(
  '/stock-adjustment',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { productId, from, to } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.createdAt = dateFilter;
    }

    const movements = await prisma.productStockAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: productId ? undefined : 200,
      include: productId ? undefined : { product: { select: { id: true, name: true, sku: true } } },
    });

    res.json(movements);
  }),
);

// GET /api/reports/sales-by-product?from=&to=
router.get(
  '/sales-by-product',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {
      salesOrder: { status: NOT_CANCELLED },
    };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      (where.salesOrder as Record<string, unknown>).createdAt = dateFilter;
    }

    const results = await prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
    });

    // Enrich with product names
    const productIds = results.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const enriched = results.map((r) => ({
      product: productMap.get(r.productId),
      totalQuantity: r._sum.quantity,
      totalRevenue: r._sum.total,
    }));

    res.json(enriched);
  }),
);

// GET /api/reports/cashier-activity?from=&to=
// Per-cashier rollup: orders processed, revenue, margin, # of modifications.
// Used by the Admin Activity view.
router.get(
  '/cashier-activity',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string | undefined>;
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date('9999-12-31');
    const orderRange: { gte?: Date; lte?: Date } = {};
    if (from) orderRange.gte = fromDate;
    if (to) orderRange.lte = toDate;
    const hasRange = !!(orderRange.gte || orderRange.lte);

    // 1. Per-cashier order totals (count + revenue).
    const orderAgg = await prisma.salesOrder.groupBy({
      by: ['processedBy'],
      where: {
        ...(hasRange ? { createdAt: orderRange } : {}),
        status: NOT_CANCELLED,
      },
      _count: { _all: true },
      _sum: { total: true },
    });
    const byUser = new Map<string, { orderCount: number; totalRevenue: number; totalMarginalProfit: number }>();
    for (const r of orderAgg) {
      byUser.set(r.processedBy, {
        orderCount: r._count._all,
        totalRevenue: r._sum.total ?? 0,
        totalMarginalProfit: 0,
      });
    }

    // 2. Per-cashier marginal profit — sum (unitPrice − cost) × qty across every
    //    item of every non-cancelled order in the range, grouped by cashier.
    const profitItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: { status: NOT_CANCELLED, createdAt: { gte: fromDate, lte: toDate } },
      },
      select: {
        unitPrice: true,
        unitCostPrice: true,
        quantity: true,
        salesOrder: { select: { processedBy: true } },
      },
    });
    for (const i of profitItems) {
      const uid = i.salesOrder.processedBy;
      const acc = byUser.get(uid);
      if (acc) {
        acc.totalMarginalProfit += (i.unitPrice - (i.unitCostPrice ?? 0)) * i.quantity;
      }
    }

    // 3. Modification counts (item_added / quantity_changed / item_removed).
    const modWhere: Record<string, unknown> = {
      action: { in: ['item_added', 'item_quantity_changed', 'item_removed'] },
    };
    if (hasRange) modWhere.createdAt = orderRange;
    const mods = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: modWhere,
      _count: { _all: true },
    });
    const modCountByUser = new Map(mods.map((m) => [m.userId, m._count._all]));

    // 4. Resolve user names (union of buckets so cashiers with only mods still appear).
    const userIds = Array.from(new Set([...byUser.keys(), ...modCountByUser.keys()]));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, role: true },
    });

    const rows = users.map((u) => {
      const o = byUser.get(u.id) ?? { orderCount: 0, totalRevenue: 0, totalMarginalProfit: 0 };
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        orderCount: o.orderCount,
        totalRevenue: o.totalRevenue,
        totalMarginalProfit: o.totalMarginalProfit,
        modificationsCount: modCountByUser.get(u.id) ?? 0,
      };
    });

    rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.json(rows);
  }),
);

// GET /api/reports/dashboard-bundle
// Single round-trip replacement for the dashboard's parallel fetches: one JSON
// payload with inventory + (role-gated) daily report, weekly trend, and recent
// orders. Everything runs in parallel against the local DB.
router.get(
  '/dashboard-bundle',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new AppError(401, 'Not authenticated');
    const role = user.role;
    const canSeeSales = role === 'admin' || role === 'owner' || role === 'cashier';
    const canSeeExpenses = role === 'admin' || role === 'owner';

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const nextDay = new Date(startOfDay);
    nextDay.setDate(startOfDay.getDate() + 1);

    // ── Week range (Sun-anchored, matches /reports/weekly semantics) ─────
    const weekEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12, 0, 0));
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekEnd.getUTCDate() - weekEnd.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStop = new Date(weekStart);
    weekStop.setUTCDate(weekStart.getUTCDate() + 7);

    const dayOrderWhere: Prisma.SalesOrderWhereInput = {
      createdAt: { gte: startOfDay, lt: nextDay },
      status: NOT_CANCELLED,
    };

    const [
      products,
      productAgg,
      orderAgg,
      expenseAgg,
      dayMarginalProfit,
      weekOrders,
      recentOrders,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sku: true, unit: true, stockQuantity: true },
        orderBy: { stockQuantity: 'asc' },
        take: 100,
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: { stockQuantity: true },
      }),
      canSeeSales || canSeeExpenses
        ? prisma.salesOrder.aggregate({
            where: dayOrderWhere,
            _count: { _all: true },
            _sum: { total: true, taxTotal: true },
          })
        : Promise.resolve(null),
      canSeeSales || canSeeExpenses
        ? prisma.expense.aggregate({
            where: { expenseDate: { gte: startOfDay, lt: nextDay } },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      canSeeSales || canSeeExpenses ? marginalProfitForOrders(dayOrderWhere) : Promise.resolve(0),
      canSeeSales
        ? prisma.salesOrder.findMany({
            where: { createdAt: { gte: weekStart, lt: weekStop }, status: NOT_CANCELLED },
            select: { createdAt: true, total: true },
          })
        : Promise.resolve(null),
      canSeeSales
        ? prisma.salesOrder.findMany({
            where: {},
            include: { customer: true, _count: { select: { items: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve(null),
    ]);

    // ── Build response blocks ──
    const LOW_THRESHOLD = 20;
    const lowStock = products
      .filter((p) => p.stockQuantity <= LOW_THRESHOLD)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit ?? 'pcs',
        quantityOnHand: p.stockQuantity,
        lowStockThreshold: LOW_THRESHOLD,
      }));

    const inventoryValue = {
      totalValue: 0, // /inventory/value still owns the cost-weighted figure if needed elsewhere
      totalUnits: productAgg._sum.stockQuantity ?? 0,
    };

    let dailyReport: Record<string, unknown> | null = null;
    if ((canSeeSales || canSeeExpenses) && orderAgg && expenseAgg) {
      const totalRevenue = orderAgg._sum.total ?? 0;
      const totalTax = orderAgg._sum.taxTotal ?? 0;
      const totalExpenses = expenseAgg._sum.amount ?? 0;
      dailyReport = {
        date: utcDayKey(startOfDay),
        totalOrders: orderAgg._count._all,
        totalRevenue,
        totalTax,
        totalExpenses,
        marginalProfit: dayMarginalProfit,
        netProfit: totalRevenue - totalExpenses,
      };
    }

    let weekly: { date: string; revenue: number }[] | null = null;
    if (canSeeSales && weekOrders) {
      const map = new Map<string, number>();
      for (const o of weekOrders) {
        const key = utcDayKey(o.createdAt);
        map.set(key, (map.get(key) ?? 0) + o.total);
      }
      weekly = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setUTCDate(weekStart.getUTCDate() + i);
        const key = utcDayKey(d);
        weekly.push({ date: key, revenue: map.get(key) ?? 0 });
      }
    }

    res.json({
      lowStock,
      inventoryValue,
      dailyReport,
      weekly,
      recentOrders: canSeeSales ? recentOrders ?? [] : null,
    });
  }),
);

export default router;
