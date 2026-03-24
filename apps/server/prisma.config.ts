import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrate: {
    async url() {
      return process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/bread_faculty?schema=public';
    },
  },
});
