export type DailySalesSummary = {
  id: string;
  summaryDate: string;
  totalOrders: number;
  totalRevenue: number;
  totalTaxCollected: number;
  totalRefunds: number;
  netSales: number;
  cashTotal: number;
  momoTotal: number;
  cardTotal: number;
  creditTotal: number;
  createdAt: string;
};

export type DailyProfitLoss = {
  id: string;
  reportDate: string;
  totalRevenue: number;
  totalExpenses: number;
  costOfGoodsSold?: number;
  grossProfit: number;
  netProfitLoss: number;
  createdAt: string;
};

export type DailySummary = {
  totalRevenue: number;
  totalOrders: number;
  topProducts: Array<{
    productId: string;
    _sum: { quantity: number | null; total: number | null };
  }>;
};

/** Payload for GET /api/reports/summary?from=&to= — range-aware operational summary */
export interface OperationsSummary {
  range: { from: string; to: string };
  totals: {
    orders: number;
    revenue: number;
    tax: number;
    expenses: number;
    marginalProfit: number;
    netProfit: number;
    /** Percent — (marginalProfit / revenue) * 100, or 0 when revenue is 0 */
    margin: number;
  };
  /** Per-day breakdown for the revenue trend chart. Keys are YYYY-MM-DD. */
  dailyTrend: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
}

/** Per-product profit row returned by GET /api/reports/profit-analysis?from=&to= */
export interface ProfitAnalysisRow {
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
}
