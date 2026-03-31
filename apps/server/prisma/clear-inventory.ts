import { PrismaClient } from '@prisma/client';
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Deleting all inventory data...');
  try {
    const result = await prisma.inventoryItem.deleteMany({});
    console.log(`✅ Successfully deleted ${result.count} inventory items.`);
  } catch (error: any) {
    console.error('❌ Error deleting inventory data:', error?.message || error);
    try {
      console.log('Attempting raw TRUNCATE...');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InventoryItem" CASCADE;`);
      console.log('✅ Successfully truncated.');
    } catch (e: any) {
      console.error('❌ TRUNCATE failed:', e?.message || e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
