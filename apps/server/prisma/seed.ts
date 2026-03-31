import 'dotenv/config';
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
  const cashierHash  = await bcrypt.hash('cashier123', 10);
  const bakerHash    = await bcrypt.hash('baker123', 10);

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
    { name: 'Meat Pie',             sku: 'PRD-001', category: 'pastry', price: 1100 },
    { name: 'Sausage Roll',         sku: 'PRD-002', category: 'pastry', price: 800  },
    { name: 'Chicken Pie',          sku: 'PRD-003', category: 'pastry', price: 1200 },
    { name: 'Doughnut (Sugared)',   sku: 'PRD-004', category: 'pastry', price: 500  },
    { name: 'Chocolate Cake',       sku: 'PRD-005', category: 'cake',   price: 5000 },
    { name: 'Red Velvet Cake',      sku: 'PRD-006', category: 'cake',   price: 5500 },
    { name: 'Butter Roll (6 pack)', sku: 'PRD-007', category: 'bread',  price: 1300 },
    { name: 'Coca-Cola 500ml',      sku: 'PRD-008', category: 'drink',  price: 600  },
    { name: 'Spring Water 500ml',   sku: 'PRD-009', category: 'drink',  price: 300  },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { price: p.price },
      create: { ...p, isAvailable: true },
    });
  }
  console.log(`✓ Products: ${products.length} created`);

  // ── Inventory Items ───────────────────────────────────────────────────────
  const inventoryItems = [
    { name: 'All-Purpose Flour',    unit: 'kg',   quantityOnHand: 50,  lowStockThreshold: 10, reorderQuantity: 25 },
    { name: 'Sugar',                unit: 'kg',   quantityOnHand: 30,  lowStockThreshold: 5,  reorderQuantity: 20 },
    { name: 'Butter',               unit: 'kg',   quantityOnHand: 15,  lowStockThreshold: 3,  reorderQuantity: 10 },
    { name: 'Eggs',                 unit: 'unit', quantityOnHand: 120, lowStockThreshold: 24, reorderQuantity: 60 },
    { name: 'Vegetable Oil',        unit: 'l',    quantityOnHand: 10,  lowStockThreshold: 2,  reorderQuantity: 5  },
    { name: 'Cocoa Powder',         unit: 'kg',   quantityOnHand: 5,   lowStockThreshold: 1,  reorderQuantity: 5  },
    { name: 'Minced Beef',          unit: 'kg',   quantityOnHand: 8,   lowStockThreshold: 2,  reorderQuantity: 10 },
    { name: 'Sausage Links',        unit: 'unit', quantityOnHand: 60,  lowStockThreshold: 12, reorderQuantity: 30 },
    { name: 'Chicken Breast',       unit: 'kg',   quantityOnHand: 6,   lowStockThreshold: 2,  reorderQuantity: 8  },
    { name: 'Cream Cheese',         unit: 'kg',   quantityOnHand: 4,   lowStockThreshold: 1,  reorderQuantity: 5  },
    { name: 'Packaging Boxes',      unit: 'unit', quantityOnHand: 200, lowStockThreshold: 30, reorderQuantity: 100},
    { name: 'Baking Powder',        unit: 'g',    quantityOnHand: 500, lowStockThreshold: 50, reorderQuantity: 200},
  ];

  const createdItems: Record<string, string> = {};
  for (const item of inventoryItems) {
    const created = await prisma.inventoryItem.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
    createdItems[item.name] = created.id;
  }
  console.log(`✓ Inventory items: ${inventoryItems.length} created`);

  // ── Recipes ───────────────────────────────────────────────────────────────
  const meatPieRecipe = await prisma.recipe.upsert({
    where: { name: 'Meat Pie' },
    update: {},
    create: {
      name: 'Meat Pie',
      description: 'Classic West African meat pie',
      yieldQuantity: 12,
      yieldUnit: 'pieces',
      instructions: 'Mix flour and butter for crust. Cook beef filling with onions and spices. Fill and bake at 180°C for 25 minutes.',
      ingredients: {
        create: [
          { inventoryItemId: createdItems['All-Purpose Flour'], quantityRequired: 0.5,  unit: 'kg' },
          { inventoryItemId: createdItems['Butter'],            quantityRequired: 0.15, unit: 'kg' },
          { inventoryItemId: createdItems['Minced Beef'],       quantityRequired: 0.4,  unit: 'kg' },
          { inventoryItemId: createdItems['Eggs'],              quantityRequired: 2,    unit: 'unit' },
          { inventoryItemId: createdItems['Vegetable Oil'],     quantityRequired: 0.05, unit: 'l' },
        ],
      },
    },
  });

  const sausageRollRecipe = await prisma.recipe.upsert({
    where: { name: 'Sausage Roll' },
    update: {},
    create: {
      name: 'Sausage Roll',
      description: 'Flaky pastry wrapped sausage roll',
      yieldQuantity: 20,
      yieldUnit: 'pieces',
      instructions: 'Prepare pastry dough. Wrap sausages in dough. Brush with egg wash. Bake at 200°C for 20 minutes.',
      ingredients: {
        create: [
          { inventoryItemId: createdItems['All-Purpose Flour'], quantityRequired: 0.4,  unit: 'kg' },
          { inventoryItemId: createdItems['Butter'],            quantityRequired: 0.2,  unit: 'kg' },
          { inventoryItemId: createdItems['Sausage Links'],     quantityRequired: 20,   unit: 'unit' },
          { inventoryItemId: createdItems['Eggs'],              quantityRequired: 1,    unit: 'unit' },
        ],
      },
    },
  });

  const chocolateCakeRecipe = await prisma.recipe.upsert({
    where: { name: 'Chocolate Cake' },
    update: {},
    create: {
      name: 'Chocolate Cake',
      description: 'Rich moist chocolate layer cake',
      yieldQuantity: 1,
      yieldUnit: 'whole cake',
      instructions: 'Mix dry ingredients. Cream butter and sugar. Combine wet and dry. Bake at 175°C for 35 minutes. Frost when cooled.',
      ingredients: {
        create: [
          { inventoryItemId: createdItems['All-Purpose Flour'], quantityRequired: 0.25, unit: 'kg' },
          { inventoryItemId: createdItems['Sugar'],             quantityRequired: 0.3,  unit: 'kg' },
          { inventoryItemId: createdItems['Butter'],            quantityRequired: 0.12, unit: 'kg' },
          { inventoryItemId: createdItems['Eggs'],              quantityRequired: 3,    unit: 'unit' },
          { inventoryItemId: createdItems['Cocoa Powder'],      quantityRequired: 0.08, unit: 'kg' },
          { inventoryItemId: createdItems['Baking Powder'],     quantityRequired: 10,   unit: 'g'  },
          { inventoryItemId: createdItems['Cream Cheese'],      quantityRequired: 0.2,  unit: 'kg' },
        ],
      },
    },
  });

  console.log(`✓ Recipes: ${meatPieRecipe.name}, ${sausageRollRecipe.name}, ${chocolateCakeRecipe.name}`);

  // ── Suppliers ─────────────────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { name: 'Accra Flour Mills Ltd' },
    update: {},
    create: {
      name: 'Accra Flour Mills Ltd',
      contactPerson: 'Emmanuel Agyei',
      email: 'orders@accraflour.com',
      phone: '+233 20 111 2222',
      address: '45 Industrial Road',
      city: 'Accra',
      country: 'Ghana',
      paymentTerms: 'Net 30',
    },
  });

  await prisma.supplier.upsert({
    where: { name: 'Golden Harvest Distributors' },
    update: {},
    create: {
      name: 'Golden Harvest Distributors',
      contactPerson: 'Abena Mensah',
      email: 'supply@goldenharvest.gh',
      phone: '+233 24 333 4444',
      address: '8 Commerce Street',
      city: 'Kumasi',
      country: 'Ghana',
      paymentTerms: 'Net 15',
    },
  });

  console.log('✓ Suppliers: 2 created');

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
