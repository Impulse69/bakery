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

    console.log(`[Reports] Generating week starting from ${startDate.toISOString()} (Sunday)`);

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
router.get(
  '/stock-adjustment',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { productId, from, to } = req.query as Record<string, string | undefined>;
    if (!productId) throw new AppError(400, 'productId is required');

    const where: Record<string, unknown> = { productId: productId };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.createdAt = dateFilter;
    }

    const movements = await prisma.productStockAdjustment.findMany({
      where,
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

export default router;

