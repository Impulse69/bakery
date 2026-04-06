import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/bread_faculty';
const remoteConnectionString = process.env.DIRECT_URL;

const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient | undefined,
  remotePrisma: PrismaClient | undefined 
};

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

export const remotePrisma = globalForPrisma.remotePrisma ?? (
  remoteConnectionString 
    ? new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: remoteConnectionString })) })
    : undefined
);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.remotePrisma = remotePrisma;
}
