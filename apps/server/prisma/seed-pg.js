const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database manually for seeding.');
    
    // Seed breads
    const breads = [
      { id: 'prod-bread-sugar', name: 'Sugar Bread', sku: 'BRD-SUGAR', category: 'Bread', price: 20, description: 'Sweet and soft traditional sugar bread' },
      { id: 'prod-bread-tea', name: 'Tea Bread', sku: 'BRD-TEA', category: 'Bread', price: 15, description: 'Classic tea bread, perfect for breakfast' },
      { id: 'prod-bread-butter', name: 'Butter Bread', sku: 'BRD-BUTTER', category: 'Bread', price: 25, description: 'Rich and hearty butter bread' },
      { id: 'prod-bread-wheat', name: 'Wheat Bread', sku: 'BRD-WHEAT', category: 'Bread', price: 22, description: 'Healthy and wholesome wheat bread' },
      { id: 'prod-bread-cocoa', name: 'Cocoa Bread', sku: 'BRD-COCOA', category: 'Bread', price: 30, description: 'Chocolate infused cocoa bread' }
    ];

    for (const bread of breads) {
      await client.query(
        `INSERT INTO "products" (id, name, sku, category, price, description, "isAvailable", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [bread.id, bread.name, bread.sku, bread.category, bread.price, bread.description]
      );
    }
    console.log('✅ Breads seeded via purely PG commands.');

    // Seed admin user just in case
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO "users" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      ['user-admin-seed', 'Admin User', 'admin@breadfaculty.com', hash, 'admin']
    );

    // Seed location
    await client.query(
      `INSERT INTO "locations" (id, name, address, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (name) DO NOTHING`,
      ['loc-main-seed', 'Main Bakery', '123 Bakery Lane']
    );

    console.log('🌱 Full seeding successfully completed via direct PG connection bypass.');
  } catch (err) {
    console.error('❌ Error executing direct PG query:', err);
  } finally {
    await client.end();
  }
}

main();
