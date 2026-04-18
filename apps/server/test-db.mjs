import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  await client.query('UPDATE products SET "stockQuantity" = "stockQuantity" - 1 WHERE name = $1', ['Butter Bread']);
  const res = await client.query('SELECT id, name, "stockQuantity" FROM products WHERE name = $1', ['Butter Bread']);
  
  console.log(res.rows);
  await client.end();
}
main();