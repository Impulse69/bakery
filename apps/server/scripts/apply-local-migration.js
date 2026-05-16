// One-off: apply the audit-log + lastModified* DDL to the local Postgres DB.
// The Prisma migration config points at Supabase (DIRECT_URL); the dev server
// connects to localhost (DATABASE_URL), so the schema can drift between them.
//
// Run from apps/server:   node scripts/apply-local-migration.js

const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const SQL = `
DO $$ BEGIN
  CREATE TYPE "AuditEntity" AS ENUM ('sales_order', 'sales_order_item', 'payment', 'product', 'user');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM (
    'create','update','delete','status_change',
    'item_added','item_quantity_changed','item_removed',
    'payment_added','payment_voided','password_reset'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "sales_orders"
  ADD COLUMN IF NOT EXISTS "lastModifiedAt" timestamp without time zone,
  ADD COLUMN IF NOT EXISTS "lastModifiedBy" text;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         text PRIMARY KEY,
  "entity"     "AuditEntity" NOT NULL,
  "entityId"   text NOT NULL,
  "action"     "AuditAction" NOT NULL,
  "userId"     text NOT NULL,
  "reason"     text,
  "beforeJson" jsonb,
  "afterJson"  jsonb,
  "createdAt"  timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_entityId_idx"  ON "audit_logs" ("entity", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx" ON "audit_logs" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"        ON "audit_logs" ("createdAt");
`;

async function main() {
  // Apply to the runtime DB (DATABASE_URL = localhost), NOT the migration DB.
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in apps/server/.env');
    process.exit(1);
  }
  console.log('Applying audit-log + lastModified* DDL to:', url.replace(/:\/\/[^@]*@/, '://***:***@'));

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log('✓ DDL applied successfully');
  } catch (err) {
    console.error('✗ DDL failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
