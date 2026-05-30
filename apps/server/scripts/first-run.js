// First-run bootstrap for the self-contained offline build.
//
// Invoked by the Electron host (with the bundled node + the bundle's
// node_modules) BEFORE the server starts. Idempotent:
//   1. `prisma db push` — creates/syncs the SQLite schema to match the client
//      (self-healing — no migration files, no schema-drift class of bugs).
//   2. Seeds a default admin + Main Store location on a fresh database only.
//
// Requires env: DATABASE_URL (file: URL to the SQLite DB).

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const serverDir = path.resolve(__dirname, '..');

// In the packaged bundle the deps live in `server_modules` (node_modules is
// renamed at build time because electron-builder empties any extraResources
// folder literally named node_modules). Restore a real `node_modules` via a
// directory junction so BOTH CommonJS require() and ESM imports resolve the
// normal up-tree way — NODE_PATH only works for CJS, and the Prisma CLI pulls
// in ESM-only transitive deps (zeptomatch → graphmatch) that need real
// node_modules. The junction is idempotent and needs no admin rights.
function ensureNodeModulesJunction() {
  const serverModules = path.join(serverDir, 'server_modules');
  const nodeModules = path.join(serverDir, 'node_modules');
  if (!fs.existsSync(serverModules)) return; // dev / standalone layout
  if (fs.existsSync(nodeModules)) return;     // already present
  try {
    fs.symlinkSync(serverModules, nodeModules, 'junction');
  } catch (err) {
    console.error('[first-run] Could not create node_modules junction:', err.message);
  }
}
ensureNodeModulesJunction();

// Resolve the Prisma CLI across layouts (junction makes node_modules the
// canonical path in the packaged bundle; the others cover dev/standalone).
function resolvePrismaCli() {
  const candidates = [
    path.join(serverDir, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(serverDir, 'server_modules', 'prisma', 'build', 'index.js'),
    path.join(serverDir, '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    return require.resolve('prisma/build/index.js');
  } catch {
    throw new Error('Prisma CLI not found (prisma/build/index.js)');
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[first-run] DATABASE_URL is not set');
    process.exit(1);
  }

  // 1. Sync the schema to the database file (creates it if missing).
  const prismaCli = resolvePrismaCli();
  console.log('[first-run] Syncing database schema…');
  execFileSync(process.execPath, [prismaCli, 'db', 'push'], {
    cwd: serverDir,
    stdio: 'inherit',
    env: process.env,
  });

  // 2. Seed defaults on an empty database.
  const { PrismaClient } = require('@prisma/client');
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const bcrypt = require('bcryptjs');

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@bakery.com',
          passwordHash,
          role: 'admin',
          mustChangePassword: true,
        },
      });
      console.log('[first-run] Seeded default admin (admin@bakery.com / admin123).');
    }

    // Ensure a default store location exists (sales orders require one).
    const locationCount = await prisma.location.count();
    if (locationCount === 0) {
      await prisma.location.create({
        data: { id: 'default', name: 'Main Store', address: '' },
      });
      console.log('[first-run] Seeded default location (Main Store).');
    }

    console.log('[first-run] OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[first-run] FAILED:', err.message);
  process.exit(1);
});
