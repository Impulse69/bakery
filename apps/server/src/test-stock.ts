import { prisma } from './lib/prisma.js';

async function main() {
  const products = await prisma.product.findMany();
  console.log(products.map(p => ({ id: p.id, name: p.name, stock: p.stockQuantity })));
}

main().finally(() => prisma.$disconnect());
