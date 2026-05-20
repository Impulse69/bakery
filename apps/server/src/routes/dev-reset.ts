import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';
import { logger } from '../lib/logger.js';

const router = Router();

const bodySchema = z.object({
  level: z.enum(['transactions', 'catalog', 'full']),
});

// Tables grouped by level. Order matters only for readability — TRUNCATE ... CASCADE handles FKs.
const TX_TABLES = [
  'audit_logs',
  'payments',
  'sales_order_items',
  'sales_orders',
  'product_stock_adjustments',
  'production_batches',
  'daily_production_targets',
  'expenses',
  'daily_sales_summaries',
  'daily_profit_losses',
];
const CATALOG_TABLES = [
  ...TX_TABLES,
  'product_variants',
  'products',
  'customers',
  'suppliers',
];
const FULL_TABLES = [
  ...CATALOG_TABLES,
  'document_templates',
  'locations',
  'users',
];

function tablesFor(level: 'transactions' | 'catalog' | 'full'): string[] {
  if (level === 'transactions') return TX_TABLES;
  if (level === 'catalog') return CATALOG_TABLES;
  return FULL_TABLES;
}

async function seedBaseline(level: 'transactions' | 'catalog' | 'full') {
  // Always ensure an admin + main location exist so the app is usable.
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@bakery.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@bakery.com',
      passwordHash,
      role: 'admin',
      mustChangePassword: false,
    },
  });
  await prisma.location.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: 'Main Store', address: '12 Baker Street, Accra' },
  });
  // Catalog/full wiped products too — zero stock on whatever remains is implicit (table is empty).
  if (level === 'transactions') {
    await prisma.product.updateMany({ data: { stockQuantity: 0 } });
  }
}

router.post(
  '/reset',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'Dev reset disabled in production');
    }
    const { level } = bodySchema.parse(req.body);
    const tables = tablesFor(level);
    const list = tables.map((t) => `"${t}"`).join(', ');
    logger.warn({ level, tables, user: (req as any).user?.email }, 'DEV RESET triggered');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    await seedBaseline(level);
    res.json({ ok: true, level, wiped: tables });
  })
);

export default router;
