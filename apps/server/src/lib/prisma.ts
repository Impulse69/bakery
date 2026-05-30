import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not defined');
}
// SQLite file URL, e.g. file:C:\Users\<user>\AppData\Roaming\Bread Faculty\bakery.db
const url = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaBetterSqlite3({ url });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Cloud sync is disabled in the offline build — there is no remote database.
// Kept as `undefined` so syncService keeps compiling and no-ops gracefully.
export const remotePrisma: PrismaClient | undefined = undefined;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
