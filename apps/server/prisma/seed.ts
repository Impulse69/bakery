<<<<<<< HEAD
import 'dotenv/config';
=======
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
>>>>>>> beta-build
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/bread_faculty';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ── Location ──────────────────────────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: 'default' },
    update: { name: 'Main Store' },
    create: { id: 'default', name: 'Main Store', address: '12 Baker Street, Accra' },
  });
  console.log(`✓ Location: ${location.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  const cashierHash = await bcrypt.hash('cashier123', 10);
  const bakerHash = await bcrypt.hash('baker123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bakery.com' },
    update: { passwordHash },
    create: {
      name: 'Admin User',
      email: 'admin@bakery.com',
      passwordHash,
      role: 'admin',
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@bakery.com' },
    update: { passwordHash: cashierHash },
    create: {
      name: 'Ama Cashier',
      email: 'cashier@bakery.com',
      passwordHash: cashierHash,
      role: 'cashier',
    },
  });

  const baker = await prisma.user.upsert({
    where: { email: 'baker@bakery.com' },
    update: { passwordHash: bakerHash },
    create: {
      name: 'Kofi Baker',
      email: 'baker@bakery.com',
      passwordHash: bakerHash,
      role: 'baker',
    },
  });

  console.log(`✓ Users: ${admin.email}, ${cashier.email}, ${baker.email}`);

  // ── Products ──────────────────────────────────────────────────────────────
  const products = [
    { name: 'Sugar Bread', sku: 'BRD-SGR-01', category: 'Bread', price: 3000 },
    { name: 'Tea Bread', sku: 'BRD-TEA-01', category: 'Bread', price: 2500 },
    { name: 'Butter Bread', sku: 'BRD-BTR-01', category: 'Bread', price: 3500 },
    { name: 'Wheat Bread', sku: 'BRD-WHT-01', category: 'Bread', price: 4000 },
    { name: 'Cocoa Bread', sku: 'BRD-CCO-01', category: 'Bread', price: 4000 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { price: p.price },
      create: { ...p, isAvailable: true },
    });
  }
  console.log(`✓ Products: ${products.length} created`);

  console.log('\n✅ Seeding complete!');
  console.log('\nLogin credentials:');
  console.log('  Admin:   admin@bakery.com   / admin123');
  console.log('  Cashier: cashier@bakery.com / cashier123');
  console.log('  Baker:   baker@bakery.com   / baker123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
