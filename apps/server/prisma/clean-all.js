const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' }); // load from apps/server/.env explicitly

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL DB directUrl');
    
    await client.query('TRUNCATE TABLE "products" CASCADE');
    await client.query('TRUNCATE TABLE "inventory_items" CASCADE');
    await client.query('TRUNCATE TABLE "recipes" CASCADE');
    await client.query('TRUNCATE TABLE "suppliers" CASCADE');
    
    console.log('✅ Successfully truncated all old data from tables!');
  } catch (err) {
    console.error('❌ Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
