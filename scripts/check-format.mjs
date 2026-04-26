import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];
const ignoredDirs = new Set(['.git', '.next', '.tmp', 'coverage', 'data', 'log', 'node_modules', 'test-results', 'uploads']);
const checkedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.css']);
const ignoredPathPrefixes = ['.codex/skills/', '.codex/cache/'];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walk(dir, files = []) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(relativePath, files);
      continue;
    }
    files.push(toPosix(relativePath));
  }
  return files;
}

function report(file, line, message) {
  failures.push(`${file}${line ? `:${line}` : ''}: ${message}`);
}

for (const file of walk('.')) {
  if (ignoredPathPrefixes.some(prefix => file.startsWith(prefix))) continue;
  if (!checkedExtensions.has(path.extname(file))) continue;
  const source = readFileSync(path.join(root, file), 'utf8');

  if (source.includes('\t')) report(file, 0, 'Tabs are not allowed; use spaces.');
  if (!source.endsWith('\n')) report(file, 0, 'File must end with a newline.');

  source.split(/\r?\n/).forEach((line, index) => {
    if (/[ \t]+$/.test(line)) report(file, index + 1, 'Trailing whitespace is not allowed.');
  });
}

if (failures.length > 0) {
  console.error('Format check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Format check passed.');
