import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

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
    
    // Marginal Profit calculation: (Price - WholesalePrice) * Quantity
    const totalMarginalProfit = orders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => {
        const wholesale = item.unitWholesalePrice ?? 0;
        return itemSum + ((item.unitPrice - wholesale) * item.quantity);
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

      const cost = (item.unitWholesalePrice ?? 0) * item.quantity;
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

    const startDate = new Date(endDateStr);
    startDate.setDate(startDate.getDate() - 6);

    const nextDay = new Date(endDateStr);
    nextDay.setDate(nextDay.getDate() + 1);

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
        d.setDate(d.getDate() + i);
        dailyMap.set(d.toISOString().split('T')[0], 0);
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

// GET /api/reports/stock-adjustment?itemId=&from=&to=
router.get(
  '/stock-adjustment',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { itemId, from, to } = req.query as Record<string, string | undefined>;
    if (!itemId) throw new AppError(400, 'itemId is required');

    const where: Record<string, unknown> = { inventoryItemId: itemId };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.createdAt = dateFilter;
    }

    const movements = await prisma.stockAdjustment.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
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

// GET /api/reports/weekly?endDate=YYYY-MM-DD
// Returns last 7 days of revenue data for the chart
router.get(
  '/weekly',
  requireRole('admin', 'owner', 'cashier'),
  asyncHandler(async (req, res) => {
    const endDateStr = req.query.endDate as string | undefined;
    const end = endDateStr ? new Date(endDateStr) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const orders = await prisma.salesOrder.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, total: true },
    });

    // Build a map of date -> revenue
    const revenueMap: Record<string, number> = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      revenueMap[day] = (revenueMap[day] ?? 0) + order.total;
    }

    // Fill all 7 days (even if 0 revenue)
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const day = d.toISOString().split('T')[0];
      result.push({ date: day, revenue: revenueMap[day] ?? 0 });
    }

    res.json(result);
  }),
);

export default router;

