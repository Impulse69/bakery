import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all products...');
  await prisma.product.deleteMany({});
  console.log('Products deleted.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
