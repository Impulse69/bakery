import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Tx = Prisma.TransactionClient | typeof prisma;

export async function syncProductAvailability(tx: Tx, productId: string) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stockQuantity: true, isAvailable: true, isActive: true },
  });
  if (!product || !product.isActive) return;
  const shouldBeAvailable = product.stockQuantity > 0;
  if (product.isAvailable === shouldBeAvailable) return;
  await tx.product.update({
    where: { id: productId },
    data: { isAvailable: shouldBeAvailable },
  });
}
