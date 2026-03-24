export type WsEvents = {
  'sale:created': { orderId: string; total: number };
  'sale:updated': { orderId: string; amountPaid: number };
  'stock:updated': { itemId?: string; reason?: string; batchId?: string; quantityOnHand?: number };
  'production:updated': { batchId: string; status?: string };
  'dashboard:summary': { totalRevenue: number; totalOrders: number };
};
