import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// SQLite datasource. DATABASE_URL is a file: URL set by the Electron host
// (pointing at the per-install DB in AppData). Falls back to a local dev file
// when running the server standalone.
export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
});
