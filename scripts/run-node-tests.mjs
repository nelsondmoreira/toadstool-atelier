import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const testsRoot = fileURLToPath(new URL('../tests/', import.meta.url));

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return collectTests(path);

    return entry.name.endsWith('.test.mjs') &&
      !entry.name.endsWith('.browser.test.mjs') ? [path] : [];
  });
}

const files = ['unit', 'integration', 'static']
  .flatMap(group => collectTests(join(testsRoot, group)))
  .sort();

if (files.length === 0) throw new Error('No Node test files found');

const result = spawnSync(
  process.execPath,
  ['--test', ...process.argv.slice(2), ...files],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
