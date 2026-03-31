const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const items = await prisma.inventoryItem.findMany();
    console.log('Items found:', items.length);
    if (items.length > 0) {
      console.log('Sample item:', items[0]);
    }
  } catch (error) {
    console.error('Error fetching inventory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
