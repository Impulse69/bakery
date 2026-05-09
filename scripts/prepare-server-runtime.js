const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nodeModules = path.join(root, 'node_modules');
const output = path.join(root, 'build_assets', 'server-node_modules');

function copyPackage(source) {
  const nodeModulesMarker = `${path.sep}node_modules${path.sep}`;
  const markerIndex = source.indexOf(nodeModulesMarker);
  if (markerIndex === -1) return;

  const relativePackagePath = source.slice(markerIndex + nodeModulesMarker.length);
  if (relativePackagePath.startsWith(`@bakery${path.sep}`)) return;

  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) return;

  const destination = path.join(output, relativePackagePath);
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
    verbatimSymlinks: true,
    filter: (file) => !file.includes(`${path.sep}.cache${path.sep}`),
  });
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const dependencyList = execSync(
  'npm.cmd ls --omit=dev --parseable --all --workspace @bakery/server',
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

for (const dependencyPath of dependencyList) {
  if (dependencyPath.startsWith(nodeModules)) {
    copyPackage(dependencyPath);
  }
}

const prismaClient = path.join(nodeModules, '.prisma');
if (fs.existsSync(prismaClient)) {
  fs.cpSync(prismaClient, path.join(output, '.prisma'), { recursive: true, force: true });
}

const packageLock = path.join(nodeModules, '.package-lock.json');
if (fs.existsSync(packageLock)) {
  fs.copyFileSync(packageLock, path.join(output, '.package-lock.json'));
}

console.log(`Prepared server runtime dependencies at ${output}`);
