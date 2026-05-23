// One-off: verify that the scalability indexes from
// 2026-05-23_add_scalability_indexes_inline.sql are present.
//
// Run from apps/server:   node scripts/verify-indexes.js

const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const EXPECTED = [
  'sales_orders_createdAt_idx',
  'sales_orders_completedAt_idx',
  'payments_date_idx',
  'expenses_expenseDate_idx',
  'expenses_category_expenseDate_idx',
  'product_stock_adjustments_createdAt_idx',
  'product_stock_adjustments_productId_createdAt_idx',
];

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT tablename, indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1)
       ORDER BY tablename, indexname`,
    [EXPECTED]
  );
  console.log(`Found ${rows.length}/${EXPECTED.length} expected indexes:`);
  for (const r of rows) console.log(`  ✓ ${r.tablename}.${r.indexname}`);
  const found = new Set(rows.map((r) => r.indexname));
  const missing = EXPECTED.filter((i) => !found.has(i));
  if (missing.length) {
    console.log('\nMissing:');
    for (const m of missing) console.log(`  ✗ ${m}`);
    process.exitCode = 1;
  } else {
    console.log('\nAll indexes present.');
  }
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
