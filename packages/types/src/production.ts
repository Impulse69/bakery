export type ProductionBatchStatus = 'in_progress' | 'completed' | 'failed';

export type ProductionBatch = {
  id: string;
  productId: string;
  batchNumber: string;
  quantityProduced: number;
  quantityUnit: string;
  status: ProductionBatchStatus;
  producedBy: string;
  startedAt: string;
  completedAt?: string;
  notes?: string;
  product?: any;
};

export type DailyProductionTarget = {
  id: string;
  targetDate: string;
  productId: string;
  targetQty: number;
  carriedOverShortage: number;
  actualQty: number;
  shortage: number;
  status: ProductionBatchStatus;
  createdAt: string;
  updatedAt: string;
  product?: any;
};
