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

// Best-effort, no-elevation repair of the SQLite database BEFORE anything writes
// to it. Targets the failure that surfaces only on the first write (create
// product) while reads/login still work: a non-writable DB. AppData is the
// user's own folder, so these operations succeed without admin rights.
//
//   1. Make the data dir + DB file writable (clear the read-only attribute).
//   2. Remove orphan -wal/-shm sidecars (we use DELETE journal mode).
//   3. Write-probe the real DB. On success → nothing else to do (no data loss).
//      On "read-only"/"locked" → log it (the server's error handler will show a
//      clear message). On a corrupt/unopenable DB → move it aside as a
//      timestamped backup so `db push` recreates a fresh, usable one.
function selfHeal(dbFilePath) {
  const dir = path.dirname(dbFilePath);

  // 1a. Ensure the data directory exists and is writable.
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.__writetest');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    console.log('[self-heal] data directory is writable:', dir);
  } catch (err) {
    console.error('[self-heal] data directory NOT writable:', dir, '-', err.message);
  }

  // 1b. Clear the read-only attribute on the DB file and any sidecars.
  for (const f of [dbFilePath, dbFilePath + '-journal', dbFilePath + '-wal', dbFilePath + '-shm']) {
    try {
      if (fs.existsSync(f)) fs.chmodSync(f, 0o666); // Windows: clears the read-only bit
    } catch (err) {
      console.error('[self-heal] could not clear read-only on', path.basename(f), '-', err.message);
    }
  }

  // 2. Remove orphan WAL/SHM sidecars (DELETE journal mode leaves none in normal
  //    operation; stale ones can wedge a DB). Never touch -journal (auto-recovered).
  for (const ext of ['-wal', '-shm']) {
    const f = dbFilePath + ext;
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        console.log('[self-heal] removed orphan sidecar', path.basename(f));
      }
    } catch (err) {
      console.error('[self-heal] could not remove', path.basename(f), '-', err.message);
    }
  }

  if (!fs.existsSync(dbFilePath)) {
    console.log('[self-heal] no existing DB; a fresh one will be created.');
    return;
  }

  // 3. Write-probe the existing DB (writing user_version back to itself is a real
  //    write that leaves no trace). Classify any failure.
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('[self-heal] better-sqlite3 unavailable; skipping write-probe:', err.message);
    return;
  }

  let probeErr = null;
  try {
    const db = new Database(dbFilePath, { timeout: 4000 });
    try {
      const v = Number(db.pragma('user_version', { simple: true })) || 0;
      db.pragma('user_version = ' + v); // genuine write, same value, no side effects
      console.log('[self-heal] database is writable.');
    } finally {
      db.close();
    }
    return;
  } catch (err) {
    probeErr = err;
  }

  const msg = String(probeErr && probeErr.message ? probeErr.message : probeErr).toLowerCase();
  const code = probeErr && probeErr.code;

  if (code === 'SQLITE_READONLY' || msg.includes('readonly') || msg.includes('read-only')) {
    console.error('[self-heal] DB still read-only after repair — likely an OS/AV lock or permissions:', probeErr.message);
    return;
  }
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || msg.includes('locked')) {
    console.error('[self-heal] DB is locked (antivirus/backup?):', probeErr.message);
    return;
  }
  if (
    code === 'SQLITE_NOTADB' ||
    code === 'SQLITE_CORRUPT' ||
    msg.includes('not a database') ||
    msg.includes('file is not a database') ||
    msg.includes('malformed')
  ) {
    const backup = dbFilePath + '.corrupt-' + Date.now();
    try {
      fs.renameSync(dbFilePath, backup);
      console.error('[self-heal] DB corrupt — backed up to', path.basename(backup), 'and recreating fresh.');
    } catch (err) {
      console.error('[self-heal] could not back up corrupt DB:', err.message);
    }
    return;
  }

  console.error('[self-heal] write-probe failed (unclassified):', probeErr.message);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[first-run] DATABASE_URL is not set');
    process.exit(1);
  }

  // 0. Self-heal the DB file/dir before any write (db push, seed, runtime).
  selfHeal(url.replace(/^file:/, ''));

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

    // Safety net: never allow a no-admin lockout. If no ACTIVE admin exists
    // (deleted, deactivated, or demoted), re-assert the default admin so the
    // owner can always sign in (or use in-app recovery from there).
    const activeAdmins = await prisma.user.count({ where: { role: 'admin', isActive: true } });
    if (activeAdmins === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      const existing = await prisma.user.findUnique({ where: { email: 'admin@bakery.com' } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'admin', isActive: true, passwordHash, mustChangePassword: true },
        });
        console.log('[first-run] No active admin — re-asserted default admin (admin@bakery.com).');
      } else {
        await prisma.user.create({
          data: {
            name: 'Admin User',
            email: 'admin@bakery.com',
            passwordHash,
            role: 'admin',
            mustChangePassword: true,
          },
        });
        console.log('[first-run] No active admin — created default admin (admin@bakery.com).');
      }
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
