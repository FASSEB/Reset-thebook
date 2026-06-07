import fs from 'fs/promises';
import path from 'path';

const rootDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const distDir = path.join(rootDir, 'dist');
const targetDir = rootDir;

async function moveEntry(source, destination) {
  try {
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(source, destination);
  } catch (error) {
    if (error.code === 'EXDEV') {
      await fs.cp(source, destination, { recursive: true, force: true });
      await fs.rm(source, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

async function moveDistContents() {
  const distEntries = await fs.readdir(distDir, { withFileTypes: true });

  if (distEntries.length === 0) {
    console.log('Nothing to move: dist directory is empty.');
    return;
  }

  for (const entry of distEntries) {
    const source = path.join(distDir, entry.name);
    const destination = path.join(targetDir, entry.name);
    console.log(`Moving ${entry.name} -> ${targetDir}`);
    await moveEntry(source, destination);
  }

  await fs.rm(distDir, { recursive: true, force: true });
  console.log('Moved dist contents to parent directory and removed dist.');
}

moveDistContents().catch((error) => {
  console.error('Error moving dist contents:', error);
  process.exit(1);
});
