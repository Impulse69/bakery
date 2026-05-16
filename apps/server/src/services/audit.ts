import type { Prisma, PrismaClient } from '@prisma/client';

type TxClient = PrismaClient | Prisma.TransactionClient;

export interface RecordAuditParams {
  entity: 'sales_order' | 'sales_order_item' | 'payment' | 'product' | 'user';
  entityId: string;
  action:
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
  userId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit-log writer. Call inside the same transaction as the
 * mutation so a failure rolls back both the change AND its audit row.
 *
 *   await prisma.$transaction(async (tx) => {
 *     ...mutate...
 *     await recordAudit(tx, { entity, entityId, action, userId, reason, before, after });
 *   });
 */
export async function recordAudit(
  tx: TxClient,
  params: RecordAuditParams,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      reason: params.reason ?? null,
      beforeJson: (params.before ?? null) as Prisma.InputJsonValue,
      afterJson: (params.after ?? null) as Prisma.InputJsonValue,
    },
  });
}
