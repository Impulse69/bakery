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

    const [orders, expenses] = await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          createdAt: { gte: day, lt: nextDay },
          status: { not: 'cancelled' },
        },
        include: { items: true },
      }),
      prisma.expense.findMany({
        where: {
          expenseDate: { gte: day, lt: nextDay },
        },
      }),
    ]);

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalTax = orders.reduce((s, o) => s + o.taxTotal, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    
    // Marginal Profit calculation: (sellingPrice - costPrice) * Quantity
    const totalMarginalProfit = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        const cost = item.unitCostPrice ?? 0;
        return itemSum + ((item.unitPrice - cost) * item.quantity);
      }, 0);
    }, 0);

    const netProfit = totalRevenue - totalExpenses;

    res.json({
      date: dateStr,
      totalOrders: orders.length,
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

    const [orders, expenses] = await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          createdAt: { gte: rangeFrom, lte: rangeTo },
          status: { not: 'cancelled' },
        },
        select: {
          createdAt: true,
          total: true,
          taxTotal: true,
          items: { select: { unitPrice: true, unitCostPrice: true, quantity: true } },
        },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: rangeFrom, lte: rangeTo } },
        select: { amount: true },
      }),
    ]);

    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const totalTax = orders.reduce((s, o) => s + o.taxTotal, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalMarginalProfit = orders.reduce(
      (sum, o) =>
        sum +
        o.items.reduce(
          (iSum, i) => iSum + (i.unitPrice - (i.unitCostPrice ?? 0)) * i.quantity,
          0,
        ),
      0,
    );
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (totalMarginalProfit / totalRevenue) * 100 : 0;

    // Per-day trend across the range (date keys YYYY-MM-DD)
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    const cursor = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), rangeFrom.getDate());
    const stop = new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate());
    while (cursor <= stop) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      dailyMap.set(key, { revenue: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const o of orders) {
      const d = o.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.revenue += o.total;
        bucket.orders += 1;
      }
    }
    const dailyTrend = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
    }));

    res.json({
      range: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
      totals: {
        orders: orders.length,
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

    const where: Record<string, unknown> = {
      salesOrder: { status: { not: 'cancelled' } },
    };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      (where.salesOrder as Record<string, unknown>).createdAt = dateFilter;
    }

    const items = await prisma.salesOrderItem.findMany({
      where,
      include: { product: { select: { name: true, sku: true } } },
    });

    const profitByProduct = new Map<string, any>();
    for (const item of items) {
      const key = item.productId;
      const existing = profitByProduct.get(key) || {
        productName: item.product.name,
        sku: item.product.sku,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };

      const cost = (item.unitCostPrice ?? 0) * item.quantity;
      existing.quantity += item.quantity;
      existing.revenue += item.total;
      existing.cost += cost;
      existing.profit += (item.total - cost);
      profitByProduct.set(key, existing);
    }

    res.json(Array.from(profitByProduct.values()));
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
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, total: true },
    });

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyMap.set(key, 0);
    }
    
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, dailyMap.get(dateKey)! + order.total);
      }
    }

    const results = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
    results.sort((a, b) => a.date.localeCompare(b.date));

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
    const orderRange: { gte?: Date; lte?: Date } = {};
    if (from) orderRange.gte = new Date(from);
    if (to) orderRange.lte = new Date(to);
    const hasRange = !!(orderRange.gte || orderRange.lte);

    // 1. Per-cashier order totals + margin (excluding cancelled orders).
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(hasRange ? { createdAt: orderRange } : {}),
        status: { not: 'cancelled' },
      },
      include: { items: { select: { unitPrice: true, unitCostPrice: true, quantity: true } } },
    });

    const byUser = new Map<
      string,
      { orderCount: number; totalRevenue: number; totalMarginalProfit: number }
    >();
    for (const o of orders) {
      const acc = byUser.get(o.processedBy) ?? {
        orderCount: 0,
        totalRevenue: 0,
        totalMarginalProfit: 0,
      };
      acc.orderCount += 1;
      acc.totalRevenue += o.total;
      acc.totalMarginalProfit += o.items.reduce(
        (s, i) => s + (i.unitPrice - (i.unitCostPrice ?? 0)) * i.quantity,
        0,
      );
      byUser.set(o.processedBy, acc);
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

