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
};
