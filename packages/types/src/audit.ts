export type AuditEntity =
  | 'sales_order'
  | 'sales_order_item'
  | 'payment'
  | 'product'
  | 'user';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'item_added'
  | 'item_quantity_changed'
  | 'item_removed'
  | 'payment_added'
  | 'payment_voided'
  | 'password_reset';

export type AuditLog = {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  userId: string;
  reason?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    role: string;
  };
};
