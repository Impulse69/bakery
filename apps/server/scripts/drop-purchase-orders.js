// One-off: drop the deprecated purchase_orders / purchase_order_line_items
// tables (and PurchaseOrderStatus enum) from the LOCAL dev DB.
// Supabase already updated via the MCP migration.
//
// Run from apps/server:   node scripts/drop-purchase-orders.js

const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const SQL = `
DROP TABLE IF EXISTS "purchase_order_line_items" CASCADE;
DROP TABLE IF EXISTS "purchase_orders" CASCADE;
DROP TYPE IF EXISTS "PurchaseOrderStatus";
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in apps/server/.env');
    process.exit(1);
  }
  console.log('Dropping purchase_order_* on:', url.replace(/:\/\/[^@]*@/, '://***:***@'));
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log('✓ Dropped successfully');
  } catch (err) {
    console.error('✗ Drop failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
