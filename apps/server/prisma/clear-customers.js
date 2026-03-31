
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
    console.log('Connected to database to clear customers...');

    await client.query('TRUNCATE TABLE "customers" RESTART IDENTITY CASCADE;');
    console.log('\x1b[32m%s\x1b[0m', 'Successfully cleared all customers.');
  } catch (err) {
    console.error('Error clearing customers:', err);
  } finally {
    await client.end();
  }
}

main();
