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
