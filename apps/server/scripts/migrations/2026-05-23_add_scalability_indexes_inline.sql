-- Same indexes as 2026-05-23_add_scalability_indexes.sql, but without
-- CONCURRENTLY so they can be applied via Prisma's `db execute` (which
-- wraps in a transaction). Use this only when the tables are small
-- enough that a brief lock is acceptable. For production-scale apply,
-- use the CONCURRENTLY variant via psql instead.

CREATE INDEX IF NOT EXISTS "sales_orders_createdAt_idx" ON "sales_orders" ("createdAt");
CREATE INDEX IF NOT EXISTS "sales_orders_completedAt_idx" ON "sales_orders" ("completedAt");
CREATE INDEX IF NOT EXISTS "payments_date_idx" ON "payments" ("date");
CREATE INDEX IF NOT EXISTS "expenses_expenseDate_idx" ON "expenses" ("expenseDate");
CREATE INDEX IF NOT EXISTS "expenses_category_expenseDate_idx" ON "expenses" ("category", "expenseDate");
CREATE INDEX IF NOT EXISTS "product_stock_adjustments_createdAt_idx" ON "product_stock_adjustments" ("createdAt");
CREATE INDEX IF NOT EXISTS "product_stock_adjustments_productId_createdAt_idx" ON "product_stock_adjustments" ("productId", "createdAt");
