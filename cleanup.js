import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const rootDir = argv[0] ? path.resolve(argv[0]) : process.cwd();

const keepList = [
  // Edit this list to match files or directories you want to keep.
  // Paths are relative to the target directory.
  'CNAME',
  'README.md',
  '.git',
  '.gitignore',
  'cleanup.js',
  '.nojekyll',
  'package.json',
  'rtb',
];

function normalizeRelativePath(value) {
  return value
    .replace(/\\/g, '/')
    .replace(/\/\/+/, '/')
    .replace(/\/\.$/, '')
    .replace(/\/$/, '')
    .replace(/^\.\//, '')
    .trim();
}

function buildKeepSet(list) {
  const keep = new Set();
  for (const entry of list) {
    const normalized = normalizeRelativePath(entry);
    if (!normalized) continue;
    keep.add(normalized);
    const parts = normalized.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      keep.add(parts.slice(0, i).join('/'));
    }
  }
  return keep;
}

const keepSet = buildKeepSet(keepList);

function relativePath(from, to) {
  const rel = path.relative(from, to);
  return normalizeRelativePath(rel === '' ? '.' : rel);
}

async function collectEntries(dir) {
  const entries = [];
  for (const dirent of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, dirent.name);
    const relPath = relativePath(rootDir, fullPath);
    entries.push({ fullPath, relPath, isDirectory: dirent.isDirectory() });
    if (dirent.isDirectory()) {
      entries.push(...await collectEntries(fullPath));
    }
  }
  return entries;
}

function shouldKeepPath(relPath) {
  if (keepSet.has(relPath)) {
    return true;
  }

  for (const keptPath of keepSet) {
    if (keptPath === '.') {
      continue;
    }

    if (relPath.startsWith(`${keptPath}/`)) {
      return true;
    }
  }

  return false;
}

async function removeExcept() {
  const rootPath = path.parse(rootDir).root;
  if (rootDir === rootPath) {
    throw new Error('Refusing to run on the filesystem root directory. Specify a safer target directory.');
  }

  console.log(`Cleaning directory: ${rootDir}`);
  console.log('Keeping:', Array.from(keepSet).sort().join(', '));

  const entries = await collectEntries(rootDir);
  entries.sort((a, b) => b.relPath.length - a.relPath.length);

  let deletedCount = 0;
  for (const entry of entries) {
    const shouldKeep = shouldKeepPath(entry.relPath);
    if (shouldKeep) {
      continue;
    }

    await fs.rm(entry.fullPath, { recursive: entry.isDirectory, force: true });
    console.log(`Removed: ${entry.relPath}`);
    deletedCount += 1;
  }

  console.log(`Done. Removed ${deletedCount} item${deletedCount === 1 ? '' : 's'}.`);
}

removeExcept().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
