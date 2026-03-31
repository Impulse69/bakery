
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No database connection string found in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database to clear sales history...');

    // Disable triggers/constraints temporarily for faster/cleaner truncation if needed, 
    // but CASCADE usually handles order correctly if we list them right or use CASCADE.
    // Order: items and payments first, then orders.
    
    const tables = [
      'sales_order_items',
      'payments',
      'sales_orders',
      'daily_sales_summaries',
      'daily_profit_losses'
    ];

    console.log(`Truncating tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      console.log(`- Truncated ${table}`);
    }

    console.log('\x1b[32m%s\x1b[0m', 'Successfully cleared all sales history.');
  } catch (err) {
    console.error('Error clearing sales history:', err);
  } finally {
    await client.end();
  }
}

main();
