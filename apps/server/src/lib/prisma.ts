import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/bread_faculty';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
