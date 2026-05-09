import 'dotenv/config';
process.env.JWT_SECRET = 'test-secret-only-for-tests';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';

beforeAll(async () => {
  // Ensure we are connected to the DB
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from the DB
  await prisma.$disconnect();
});
