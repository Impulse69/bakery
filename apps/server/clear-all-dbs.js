const { Client } = require('pg');

async function main() {
  const localDb = 'postgresql://user:password@localhost:5432/bread_faculty';
  const supabaseDb = process.env.DATABASE_URL;

  let urls = [localDb, 'postgresql://postgres:postgres@localhost:5432/bread_faculty', 'postgresql://postgres:postgres@localhost:5432/postgres'];
  require('dotenv').config();
  if (process.env.DIRECT_URL) urls.push(process.env.DIRECT_URL);
  
  for (const dbUrl of urls) {
      const client = new Client({ connectionString: dbUrl });
      try {
        await client.connect();
        console.log(`Connected to: ${dbUrl}`);
        
        await client.query('TRUNCATE TABLE "inventory_items" CASCADE');
        console.log(`✅ Successfully truncated inventory_items on ${dbUrl}`);
      } catch (err) {
        console.error(`❌ Error on ${dbUrl}:`, err.message);
      } finally {
        await client.end().catch(()=>{});
      }
  }
}

main();
