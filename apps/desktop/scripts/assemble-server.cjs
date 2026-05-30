// Assemble a self-contained server bundle for packaging into the Electron app.
//
// Produces apps/desktop/server-bundle/ containing everything the embedded
// server needs at runtime on the client machine:
//   dist/            compiled server
//   prisma/          schema (first-run db push builds the SQLite tables)
//   prisma.config.ts datasource (reads DATABASE_URL = file:)
//   scripts/first-run.js + install/uninstall (first-run is the one used)
//   node_modules/    production deps incl. prisma CLI + better-sqlite3 (Win prebuild)
//   runtime/node.exe the Node used to run the server child (matches the
//                    better-sqlite3 ABI because it's this build machine's node)
//   package.json     pruned manifest
//
// electron-builder copies this to resources/server via extraResources.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const serverSrc = path.join(repoRoot, 'apps', 'server');
const staging = path.join(repoRoot, 'apps', 'desktop', 'server-bundle');

function log(msg) { console.log(`[assemble-server] ${msg}`); }

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

// 1. Build the server (tsc → dist)
log('Building server (tsc)…');
execFileSync('npx', ['tsc'], { cwd: serverSrc, stdio: 'inherit', shell: true });

// 2. Fresh staging dir
log('Staging…');
rmrf(staging);
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(path.join(staging, 'runtime'), { recursive: true });

// 3. Copy runtime files
copyDir(path.join(serverSrc, 'dist'), path.join(staging, 'dist'));
// Drop any stale node-windows daemon artifacts (the offline build doesn't use
// the Windows service — Electron spawns the server directly).
rmrf(path.join(staging, 'dist', 'daemon'));
// prisma/ but without the (now-empty) migrations dir; schema + nothing else
fs.mkdirSync(path.join(staging, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(serverSrc, 'prisma', 'schema.prisma'), path.join(staging, 'prisma', 'schema.prisma'));
fs.copyFileSync(path.join(serverSrc, 'prisma.config.ts'), path.join(staging, 'prisma.config.ts'));
copyDir(path.join(serverSrc, 'scripts'), path.join(staging, 'scripts'));

// 4. Pruned package.json (drop workspace + service-only deps; add prisma CLI)
const srcPkg = JSON.parse(fs.readFileSync(path.join(serverSrc, 'package.json'), 'utf8'));
const DROP = new Set(['@bakery/types', '@bakery/utils', 'node-windows']);
const deps = {};
for (const [name, ver] of Object.entries(srcPkg.dependencies || {})) {
  if (!DROP.has(name)) deps[name] = ver;
}
deps['prisma'] = srcPkg.devDependencies?.prisma || '^7.5.0'; // CLI needed for first-run db push
const stagedPkg = {
  name: 'bread-faculty-server',
  version: srcPkg.version || '0.0.0',
  private: true,
  dependencies: deps,
};
fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify(stagedPkg, null, 2));

// 5. Install production deps (fetches the Windows better-sqlite3 prebuild + prisma engines)
log('Installing production deps (this fetches native prebuilds)…');
execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: staging, stdio: 'inherit', shell: true });

// 6. Pre-generate the Prisma client so the server can import it without a runtime generate
log('Generating Prisma client…');
execFileSync('npx', ['prisma', 'generate'], {
  cwd: staging,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: 'file:./prisma/bakery.db' },
});

// 7. Bundle the Node runtime (this build machine's node — matches the prebuild ABI)
const nodeExe = process.execPath;
fs.copyFileSync(nodeExe, path.join(staging, 'runtime', 'node.exe'));

// 8. Rename node_modules -> server_modules.
// electron-builder special-cases any directory literally named "node_modules"
// in extraResources and copies it EMPTY. Renaming dodges that; the Electron
// host + first-run set NODE_PATH to this folder so require() still resolves.
// (Dependency tree is fully hoisted/flat — verified no nested node_modules —
// so NODE_PATH as a global resolution fallback covers every module.)
const nmDir = path.join(staging, 'node_modules');
const smDir = path.join(staging, 'server_modules');
if (fs.existsSync(nmDir)) {
  rmrf(smDir);
  fs.renameSync(nmDir, smDir);
  log('Renamed node_modules -> server_modules (electron-builder copy workaround).');
}

log(`Done. Bundle at ${staging}`);
