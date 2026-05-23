import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { logger } from '../lib/logger.js';

const router = Router();

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

    const [orderAgg, expenseAgg, profitRows] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: {
          createdAt: { gte: day, lt: nextDay },
          status: { not: 'cancelled' },
        },
        _count: { _all: true },
        _sum: { total: true, taxTotal: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: day, lt: nextDay } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ marginal_profit: bigint | null }[]>`
        SELECT COALESCE(SUM((i."unitPrice" - COALESCE(i."unitWholesalePrice", 0)) * i.quantity), 0)::bigint AS marginal_profit
        FROM "sales_order_items" i
        JOIN "sales_orders" o ON o.id = i."salesOrderId"
        WHERE o."createdAt" >= ${day}
          AND o."createdAt" < ${nextDay}
          AND o.status != 'cancelled'
      `,
    ]);

    const totalRevenue = orderAgg._sum.total ?? 0;
    const totalTax = orderAgg._sum.taxTotal ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const totalMarginalProfit = Number(profitRows[0]?.marginal_profit ?? 0);
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

    const [orderAgg, expenseAgg, profitRows, trendRows] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: {
          createdAt: { gte: rangeFrom, lte: rangeTo },
          status: { not: 'cancelled' },
        },
        _count: { _all: true },
        _sum: { total: true, taxTotal: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ marginal_profit: bigint | null }[]>`
        SELECT COALESCE(SUM((i."unitPrice" - COALESCE(i."unitWholesalePrice", 0)) * i.quantity), 0)::bigint AS marginal_profit
        FROM "sales_order_items" i
        JOIN "sales_orders" o ON o.id = i."salesOrderId"
        WHERE o."createdAt" >= ${rangeFrom}
          AND o."createdAt" <= ${rangeTo}
          AND o.status != 'cancelled'
      `,
      prisma.$queryRaw<{ day: Date; revenue: bigint | null; orders: bigint }[]>`
        SELECT date_trunc('day', o."createdAt") AS day,
               COALESCE(SUM(o.total), 0)::bigint AS revenue,
               COUNT(*)::bigint AS orders
        FROM "sales_orders" o
        WHERE o."createdAt" >= ${rangeFrom}
          AND o."createdAt" <= ${rangeTo}
          AND o.status != 'cancelled'
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const totalRevenue = orderAgg._sum.total ?? 0;
    const totalTax = orderAgg._sum.taxTotal ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const totalMarginalProfit = Number(profitRows[0]?.marginal_profit ?? 0);
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (totalMarginalProfit / totalRevenue) * 100 : 0;

    // Build a complete per-day series (fill missing days with zeros) so the
    // frontend chart axis stays contiguous across the range.
    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (const r of trendRows) {
      const key = r.day.toISOString().split('T')[0];
      trendMap.set(key, { revenue: Number(r.revenue ?? 0), orders: Number(r.orders) });
    }
    const dailyTrend: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate());
    const stop = new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate());
    while (cursor <= stop) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
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

    type Row = {
      productName: string;
      sku: string | null;
      quantity: bigint;
      revenue: bigint;
      cost: bigint;
      profit: bigint;
    };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        p.name                                                                                AS "productName",
        p.sku                                                                                 AS sku,
        COALESCE(SUM(i.quantity), 0)::bigint                                                  AS quantity,
        COALESCE(SUM(i.total), 0)::bigint                                                     AS revenue,
        COALESCE(SUM(COALESCE(i."unitWholesalePrice", 0) * i.quantity), 0)::bigint            AS cost,
        COALESCE(SUM(i.total - COALESCE(i."unitWholesalePrice", 0) * i.quantity), 0)::bigint  AS profit
      FROM "sales_order_items" i
      JOIN "sales_orders"      o ON o.id = i."salesOrderId"
      JOIN "products"          p ON p.id = i."productId"
      WHERE o.status != 'cancelled'
        AND o."createdAt" >= ${fromDate}
        AND o."createdAt" <= ${toDate}
      GROUP BY i."productId", p.name, p.sku
      ORDER BY profit DESC
    `;

    res.json(
      rows.map((r) => ({
        productName: r.productName,
        sku: r.sku,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
      })),
    );
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

    const rows = await prisma.$queryRaw<{ day: Date; revenue: bigint | null }[]>`
      SELECT date_trunc('day', o."createdAt") AS day,
             COALESCE(SUM(o.total), 0)::bigint AS revenue
      FROM "sales_orders" o
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <  ${nextDay}
        AND o.status != 'cancelled'
      GROUP BY 1
    `;

    const revenueByDate = new Map<string, number>();
    for (const r of rows) {
      revenueByDate.set(r.day.toISOString().split('T')[0], Number(r.revenue ?? 0));
    }

    const results: { date: string; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      const key = d.toISOString().split('T')[0];
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
      salesOrder: { status: { not: 'cancelled' } },
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

    // 1. Per-cashier order totals (count + revenue) — aggregated on the
    //    orders table directly so SUM(o.total) is correct.
    const orderAgg = await prisma.salesOrder.groupBy({
      by: ['processedBy'],
      where: {
        ...(hasRange ? { createdAt: orderRange } : {}),
        status: { not: 'cancelled' },
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

    // 2. Per-cashier marginal profit — sum (unitPrice - cost) * qty across
    //    every item on every non-cancelled order in the range. Joined to
    //    sales_orders so we can group by the cashier (processedBy).
    type ProfitRow = { userId: string; marginalProfit: bigint };
    const profitRows = await prisma.$queryRaw<ProfitRow[]>`
      SELECT
        o."processedBy" AS "userId",
        COALESCE(SUM((i."unitPrice" - COALESCE(i."unitWholesalePrice", 0)) * i.quantity), 0)::bigint AS "marginalProfit"
      FROM "sales_order_items" i
      JOIN "sales_orders" o ON o.id = i."salesOrderId"
      WHERE o.status != 'cancelled'
        AND o."createdAt" >= ${fromDate}
        AND o."createdAt" <= ${toDate}
      GROUP BY o."processedBy"
    `;
    for (const p of profitRows) {
      const acc = byUser.get(p.userId);
      if (acc) acc.totalMarginalProfit = Number(p.marginalProfit);
    }

    // 2. Modification counts (item_added / quantity_changed / item_removed).
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

    // 3. Resolve user names (union of buckets so cashiers with only mods still appear).
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

export default router;

