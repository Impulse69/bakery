import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';

async function main() {
  const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const p = await prisma.product.findFirst({ where: { name: 'Butter Bread' } });
  console.log('Stock before:', p.stockQuantity);
  
  await prisma.product.update({
    where: { id: p.id },
    data: { stockQuantity: { decrement: 1 } }
  });
  
  const p2 = await prisma.product.findUnique({ where: { id: p.id } });
  console.log('Stock after decrement:', p2.stockQuantity);

  await prisma.$disconnect();
}
main();