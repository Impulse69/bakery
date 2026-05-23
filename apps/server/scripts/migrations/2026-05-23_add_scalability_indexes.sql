-- Scalability P0: add hot-path indexes for date-range report queries.
--
-- Every dashboard/report query filters on createdAt/expenseDate but the
-- existing schema had no indexes on those columns, forcing seq scans on
-- sales_orders, expenses, and product_stock_adjustments.
--
-- All statements use CREATE INDEX CONCURRENTLY so they do not lock the
-- tables. Safe to run on a live database.
--
-- Run from the server box:
--   psql "$DATABASE_URL" -f apps/server/scripts/migrations/2026-05-23_add_scalability_indexes.sql
--
-- Note: CONCURRENTLY cannot run inside a transaction block, hence no
-- BEGIN/COMMIT. If a statement fails, drop the partial index manually
-- (DROP INDEX CONCURRENTLY IF EXISTS <name>) and re-run.

-- sales_orders: every report filters on createdAt; completedAt powers receipts/audits.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sales_orders_createdAt_idx"
  ON "sales_orders" ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sales_orders_completedAt_idx"
  ON "sales_orders" ("completedAt");

-- payments: date is the primary filter for payments-by-day rollups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_date_idx"
  ON "payments" ("date");

-- expenses: expenseDate is the primary report filter; (category, expenseDate)
-- supports the Operations panel's per-category-in-range breakdown.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "expenses_expenseDate_idx"
  ON "expenses" ("expenseDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "expenses_category_expenseDate_idx"
  ON "expenses" ("category", "expenseDate");

-- product_stock_adjustments: createdAt for the stock-movement timeline;
-- (productId, createdAt) for the per-product filter.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_stock_adjustments_createdAt_idx"
  ON "product_stock_adjustments" ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_stock_adjustments_productId_createdAt_idx"
  ON "product_stock_adjustments" ("productId", "createdAt");
