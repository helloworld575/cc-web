import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];

const ignoredDirs = new Set([
  '.git',
  '.next',
  '.tmp',
  'coverage',
  'data',
  'log',
  'node_modules',
  'test-results',
  'uploads',
]);

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
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

function report(file, message) {
  failures.push(`${file}: ${message}`);
}

function assertNodeRuntimeForServerRoutes(files) {
  const nodeOnlyPattern = /from ['"](@\/lib\/db|fs|fs\/promises|path)['"]|require\(['"](@\/lib\/db|fs|fs\/promises|path)['"]\)|new ReadableStream|text\/event-stream/;

  for (const file of files.filter(item => item.startsWith('app/api/') && item.endsWith('/route.ts'))) {
    const source = readText(file);
    if (!nodeOnlyPattern.test(source)) continue;
    if (!/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/.test(source)) {
      report(file, 'API routes that touch SQLite, filesystem, or streaming must export runtime = "nodejs".');
    }
  }
}

function assertRequestBoundaryIsIsolated(files) {
  const requestBoundary = files.find(file => file === 'proxy.ts') ?? files.find(file => file === 'middleware.ts');
  if (!requestBoundary) return;
  const source = readText(requestBoundary);
  const forbidden = [
    { pattern: /from ['"](@\/lib\/db|better-sqlite3|fs|fs\/promises|path)['"]/, label: 'Node-only imports' },
    { pattern: /from ['"]@\/lib\/auth['"]/, label: 'NextAuth server config imports' },
  ];
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) report(requestBoundary, `${rule.label} are not allowed in the request proxy.`);
  }
}

function assertLayerBoundaries(files) {
  const appClientFiles = files.filter(file => (
    (file.startsWith('app/') || file.startsWith('components/')) &&
    ['.ts', '.tsx'].includes(path.extname(file))
  ));

  for (const file of appClientFiles) {
    const source = readText(file);
    const isApiRoute = file.startsWith('app/api/') && file.endsWith('/route.ts');
    const isServerOnlyAppFile = /export\s+const\s+runtime\s*=\s*['"]nodejs['"]/.test(source);

    if (!isApiRoute && !isServerOnlyAppFile && /from ['"]@\/lib\/db['"]/.test(source)) {
      report(file, 'UI and non-API app files must not import the SQLite database layer directly.');
    }

    if (file.startsWith('components/') && /from ['"](fs|fs\/promises|path|better-sqlite3)['"]/.test(source)) {
      report(file, 'Shared React components must not import Node-only modules.');
    }
  }
}

function assertStyleBoundaries(files) {
  for (const file of files) {
    if (/\.module\.(css|scss|sass)$/.test(file)) {
      report(file, 'CSS modules are not allowed; this repo is Tailwind-first.');
    }
  }

  for (const file of files.filter(item => sourceExtensions.has(path.extname(item)))) {
    const source = readText(file);
    if (/from ['"]@uiw\/react-md-editor['"]/.test(source)) {
      report(file, 'Use components/MarkdownEditor.tsx instead of importing @uiw/react-md-editor directly.');
    }
  }
}

function assertCodexSourceOfTruth() {
  if (!existsSync(path.join(root, '.codex/skills'))) {
    report('.codex/skills', 'Runtime AI skills must live in .codex/skills/.');
  }
  if (existsSync(path.join(root, '.claude/skills'))) {
    report('.claude/skills', 'Legacy .claude/skills must not be reintroduced as a runtime skill source.');
  }
}

function assertNoLargeClientFiles(files) {
  const largeFileLimit = 900;
  for (const file of files.filter(item => item.endsWith('.tsx') && (item.startsWith('app/') || item.startsWith('components/')))) {
    const lines = readText(file).split('\n').length;
    if (lines > largeFileLimit) {
      report(file, `React file has ${lines} lines; split large UI/state modules before extending further.`);
    }
  }
}

function assertToolTabCodeSplitting() {
  const toolsPage = 'app/tools/page.tsx';
  if (!existsSync(path.join(root, toolsPage))) return;
  const source = readText(toolsPage);
  const heavyToolImports = [
    'AIChatTool',
    'AIImageTool',
    'FortuneTool',
    'SubscriptionBriefsTool',
  ];

  for (const component of heavyToolImports) {
    const staticImport = new RegExp(`import\\s+${component}\\s+from\\s+['\"]@/components/${component}['\"]`);
    if (staticImport.test(source)) {
      report(toolsPage, `${component} must be loaded with next/dynamic so inactive tool tabs stay out of the initial bundle.`);
    }
  }
}

function assertPackageScripts() {
  const pkg = JSON.parse(readText('package.json'));
  const requiredScripts = ['lint:architecture', 'typecheck', 'verify', 'verify:large'];
  for (const script of requiredScripts) {
    if (!pkg.scripts?.[script]) report('package.json', `Missing required script "${script}".`);
  }
}

const files = walk('.');
assertNodeRuntimeForServerRoutes(files);
assertRequestBoundaryIsIsolated(files);
assertLayerBoundaries(files);
assertStyleBoundaries(files);
assertCodexSourceOfTruth();
assertNoLargeClientFiles(files);
assertToolTabCodeSplitting();
assertPackageScripts();

if (failures.length > 0) {
  console.error('Architecture check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Architecture check passed.');
