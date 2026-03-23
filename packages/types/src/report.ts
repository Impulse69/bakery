export type PaymentBreakdown = {
  cash: number;
  card: number;
  check: number;
};

export type DailySalesSummary = {
  id: string;
  summaryDate: string;
  totalOrders: number;
  totalRevenue: number;
  totalTaxCollected: number;
  totalRefunds: number;
  netSales: number;
  paymentBreakdown: PaymentBreakdown;
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
