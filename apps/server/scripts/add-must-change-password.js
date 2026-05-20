// One-off: add the mustChangePassword column to the local users table.
// Supabase already updated via MCP migration.
//
// Run from apps/server:   node scripts/add-must-change-password.js

const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const SQL = `
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log('✓ users.mustChangePassword added');
  } catch (err) {
    console.error('✗', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
