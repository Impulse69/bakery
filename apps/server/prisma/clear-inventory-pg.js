const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    // Using CASCADE in case there are other tables like RecipeIngredient that reference this table.
    // If we shouldn't use CASCADE, we can just omit it, but if it fails we will get an error.
    await client.query('TRUNCATE TABLE "inventory_items" CASCADE');
    console.log('✅ Successfully truncated the inventory_items table.');

    
  } catch (err) {
    console.error('❌ Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
