import fs from 'fs';
import path from 'path';

const root = process.cwd();
const cacheDir = path.join(root, '.codex', 'cache');
const generatedAt = new Date().toISOString();

const DIRECTORY_DESCRIPTIONS = {
  app: 'Next.js App Router pages, layouts, and API routes.',
  components: 'Shared client and server React components.',
  lib: 'Server-side helpers for auth, SQLite, AI skills, fetchers, i18n, X integration, and fortune logic.',
  tests: 'Vitest coverage, mainly for API routes.',
  docs: 'English and Chinese user/development/API documentation.',
  '.codex': 'Codex-native cache, guidance, and the runtime AI skill catalog.',
  '.kiro': 'Legacy Kiro steering notes for AI features.',
  '.idea': 'IDE metadata with low architectural value.',
};

const KEY_FILE_DESCRIPTIONS = {
  'AGENTS.md': 'Codex working guide for repository-specific workflow and constraints.',
  'middleware.ts': 'Edge middleware for admin auth protection and auth-route rate limiting.',
  'package.json': 'Project metadata and npm scripts for Next.js, Vitest, and Codex cache refresh.',
  'next.config.mjs': 'Next.js configuration.',
  'tailwind.config.ts': 'Tailwind theme configuration.',
  'lib/db.ts': 'SQLite connection, schema bootstrap, light migrations, indexes, and prepared statements.',
  'lib/auth.ts': 'NextAuth credentials configuration and session helpers.',
  'lib/skills.ts': 'Reads and writes runtime AI skills from .codex/skills.',
  'lib/fetchers.ts': 'Subscription source fetchers and content normalization helpers.',
  'lib/xapi.ts': 'X/Twitter API integration and media upload helpers.',
  'lib/i18n.ts': 'Localization strings and locale helpers.',
  'app/layout.tsx': 'Root layout, global shell, and shared providers.',
  'app/page.tsx': 'Homepage entry point.',
  'app/tools/page.tsx': 'Tool hub entry page.',
  'app/admin/layout.tsx': 'Admin shell and protected navigation.',
  'app/api/ai/route.ts': 'Generic AI skill execution route.',
  'app/api/ai-chat/route.ts': 'Streaming AI chat session management.',
  'app/api/ai-providers/route.ts': 'Read-only env-backed AI provider listing.',
  'app/api/blog/route.ts': 'Blog collection API.',
  'app/api/blog/[slug]/route.ts': 'Single-post blog API.',
  'app/api/files/route.ts': 'Uploaded file metadata API.',
  'app/api/uploads/[...path]/route.ts': 'Uploaded file streaming endpoint.',
  'app/api/subscriptions/route.ts': 'Subscription source CRUD.',
  'app/api/subscriptions/crawl/route.ts': 'Crawl subscription content into raw stored items.',
  'app/api/subscriptions/integrate/route.ts': 'Generate briefs from stored subscription items.',
  'app/api/subscriptions/fetch/route.ts': 'Compatibility alias for subscription integration.',
  'app/api/subscriptions/briefs/route.ts': 'Subscription brief retrieval.',
  'app/api/fortune/route.ts': 'Streaming fortune analysis route with history integration.',
  'app/api/bazi/route.ts': 'Dedicated BaZi streaming route.',
};

const API_ROUTE_DESCRIPTIONS = {
  '/api/ai': 'Execute reusable AI skills against submitted content.',
  '/api/ai-chat': 'Create and stream AI chat sessions.',
  '/api/ai-chat/[id]': 'Read, update, or delete stored AI chat sessions.',
  '/api/ai-providers': 'List env-backed AI providers.',
  '/api/ai-providers/[id]': 'Read a single env-backed AI provider.',
  '/api/ai-providers/test': 'Test an AI provider with a non-streaming call.',
  '/api/albums': 'Album CRUD for uploaded files.',
  '/api/albums/[id]': 'Single-album operations.',
  '/api/auth/[...nextauth]': 'NextAuth credentials endpoint.',
  '/api/bazi': 'Specialized BaZi analysis endpoint.',
  '/api/blog': 'List or create blog content.',
  '/api/blog/[slug]': 'Read, update, or delete a single blog post.',
  '/api/diary': 'Diary entry CRUD.',
  '/api/diary/[id]': 'Single diary entry operations.',
  '/api/files': 'File metadata CRUD.',
  '/api/files/[id]': 'Single file operations.',
  '/api/fortune': 'General fortune workflow with streaming response.',
  '/api/fortune/history': 'Fortune history listing and creation.',
  '/api/fortune/history/[id]': 'Read or delete a single fortune record.',
  '/api/skills': 'List and manage web-app AI skills.',
  '/api/skills/[id]': 'Read, update, or delete a single skill.',
  '/api/subscriptions': 'Manage subscription sources.',
  '/api/subscriptions/[id]': 'Single subscription source operations.',
  '/api/subscriptions/briefs': 'List stored subscription briefs.',
  '/api/subscriptions/crawl': 'Fetch remote subscription content into raw stored items without AI.',
  '/api/subscriptions/integrate': 'Generate subscription briefs from stored crawl items.',
  '/api/subscriptions/fetch': 'Compatibility alias for subscription integration.',
  '/api/todos': 'Todo CRUD.',
  '/api/todos/[id]': 'Single todo operations.',
  '/api/uploads/[...path]': 'Stream uploaded files from disk.',
  '/api/x-auth': 'X/Twitter authentication flow.',
  '/api/x-post': 'Publish generated content to X/Twitter.',
};

const PAGE_ROUTE_DESCRIPTIONS = {
  '/': 'Public homepage.',
  '/blog': 'Public blog index.',
  '/blog/[slug]': 'Single blog post page.',
  '/files': 'Public or shared file listing page.',
  '/login': 'Credentials login page.',
  '/tools': 'Main tool hub.',
  '/admin/ai-config': 'Admin page for AI provider configuration.',
  '/admin/blog': 'Admin blog list/editor entry.',
  '/admin/blog/[slug]': 'Admin editor for a single blog post.',
  '/admin/diary': 'Diary management page.',
  '/admin/files': 'File and album management page.',
  '/admin/skills': 'Admin skill management UI.',
  '/admin/subscriptions': 'Subscription source and brief management.',
  '/admin/tools': 'Admin tool dashboard.',
  '/admin/x-post': 'Publish content to X/Twitter.',
};

const SKILL_DESCRIPTION_OVERRIDES = {
  'article-brief': 'Generate a short excerpt or summary teaser for a blog post.',
  'article-faq': 'Generate a reader-facing FAQ section for an article.',
  'article-polish': 'Rewrite and polish article copy for clarity and engagement.',
  'article-structure': 'Restructure an article to improve flow and readability.',
  'article-tags': 'Extract high-value tags and keywords for a post.',
  'article-title': 'Generate SEO-friendly headline or title options.',
  'article-translate-en': 'Translate Chinese article content into natural English.',
  'bazi-fortune': 'BaZi / Four Pillars fortune analysis skill with helper scripts.',
  'blog-to-x': 'Convert long-form blog or diary content into X/Twitter posts or threads.',
  'liuyao-fortune': 'Liu Yao / I Ching divination skill with helper scripts.',
  'meihua-fortune': 'Meihua Yishu numerology divination skill with helper scripts.',
  'source-credibility-check': 'Evaluate fetched sources for reliability, freshness, conflicts, and verification needs.',
  'subscription': 'Summarize the latest updates from subscribed sources such as blogs, GitHub, X, RSS, or Reddit.',
  'web-research-brief': 'Summarize fetched web, RSS, search, or crawler output into a source-grounded research brief.',
  'ziwei-fortune': 'Zi Wei Dou Shu astrology analysis skill with helper scripts.',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function posix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

function parseFrontmatterValue(frontmatter, key) {
  const regex = new RegExp(`^${key}:\\s*(.*)$`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return undefined;
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function fileRouteFromAppFile(relativePath) {
  const normalized = posix(relativePath);
  const withoutApp = normalized.replace(/^app\//, '');
  if (withoutApp.endsWith('/page.tsx')) {
    const route = withoutApp.replace(/\/page\.tsx$/, '');
    return route ? `/${route}` : '/';
  }
  if (withoutApp === 'page.tsx') return '/';
  if (withoutApp.endsWith('/route.ts')) {
    return `/${withoutApp.replace(/\/route\.ts$/, '')}`;
  }
  return null;
}

function listFiles(relativeDir, predicate = () => true) {
  const dir = path.join(root, relativeDir);
  return walk(dir)
    .map((fullPath) => posix(path.relative(root, fullPath)))
    .filter(predicate)
    .sort();
}

function parseDbMetadata() {
  const dbFile = path.join(root, 'lib', 'db.ts');
  if (!fs.existsSync(dbFile)) return { pragmas: [], tables: [], migrations: [], preparedStatements: [] };
  const source = fs.readFileSync(dbFile, 'utf8');
  const pragmas = [...source.matchAll(/db\.pragma\('([^']+)'/g)].map((m) => m[1]);
  const tables = [...source.matchAll(/CREATE TABLE IF NOT EXISTS ([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
  const migrations = [...source.matchAll(/ALTER TABLE ([a-zA-Z0-9_]+) ADD COLUMN ([a-zA-Z0-9_]+)/g)].map((m) => ({
    table: m[1],
    column: m[2],
  }));
  const preparedBlock = source.match(/export const stmts = \{([\s\S]*?)\n\};/);
  const preparedStatements = preparedBlock
    ? [...preparedBlock[1].matchAll(/^\s*([a-zA-Z0-9_]+):\s*db\.prepare/mg)].map((m) => m[1])
    : [];
  return { pragmas, tables, migrations, preparedStatements };
}

function parseSkills() {
  const base = path.join(root, '.codex', 'skills');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'SKILL.md')))
    .map((entry) => {
      const file = path.join(base, entry.name, 'SKILL.md');
      const raw = fs.readFileSync(file, 'utf8');
      const frontmatter = getFrontmatter(raw);
      const name = parseFrontmatterValue(frontmatter, 'name')
        || parseFrontmatterValue(frontmatter, 'name_zh')
        || entry.name;
      const description = parseFrontmatterValue(frontmatter, 'description')
        || parseFrontmatterValue(frontmatter, 'description_zh')
        || '';
      return {
        id: entry.name,
        name,
        description: SKILL_DESCRIPTION_OVERRIDES[entry.name] || description,
        hasSystem: frontmatter.includes('\nsystem:'),
        hasPrompt: frontmatter.includes('\nprompt:'),
        output: parseFrontmatterValue(frontmatter, 'output') || null,
        hasScripts: fs.existsSync(path.join(base, entry.name, 'scripts')),
        hasReferences: fs.existsSync(path.join(base, entry.name, 'references')),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function describeDirectory(dir) {
  return DIRECTORY_DESCRIPTIONS[dir] || '';
}

function describeFile(file) {
  return KEY_FILE_DESCRIPTIONS[file] || '';
}

function describeApiRoute(route) {
  return API_ROUTE_DESCRIPTIONS[route] || 'API route in the application backend.';
}

function describePageRoute(route) {
  return PAGE_ROUTE_DESCRIPTIONS[route] || 'Page route in the Next.js App Router tree.';
}

ensureDir(cacheDir);

const pkg = readJson(path.join(root, 'package.json'));
const pageFiles = listFiles('app', (file) => file.endsWith('/page.tsx') || file === 'app/page.tsx');
const apiFiles = listFiles('app/api', (file) => file.endsWith('/route.ts'));
const componentFiles = listFiles('components', (file) => file.endsWith('.ts') || file.endsWith('.tsx'));
const libFiles = listFiles('lib', (file) => file.endsWith('.ts') || file.endsWith('.tsx'));
const testFiles = listFiles('tests', (file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx'));
const docsFiles = listFiles('docs', (file) => file.endsWith('.md'));
const ideaFiles = listFiles('.idea');
const kiroFiles = listFiles('.kiro');
const skills = parseSkills();
const db = parseDbMetadata();

const pageRoutes = pageFiles.map((file) => {
  const route = fileRouteFromAppFile(file);
  return {
    route,
    file,
    description: describePageRoute(route),
  };
});

const apiRoutes = apiFiles.map((file) => {
  const route = fileRouteFromAppFile(file);
  return {
    route,
    file,
    description: describeApiRoute(route),
  };
});

const keyFiles = Object.keys(KEY_FILE_DESCRIPTIONS)
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map((file) => ({ file, description: describeFile(file) }));

const cache = {
  generatedAt,
  project: {
    name: pkg.name,
    version: pkg.version,
    private: pkg.private,
    packageManager: fs.existsSync(path.join(root, 'package-lock.json')) ? 'npm' : 'unknown',
    framework: 'Next.js 14 App Router',
    language: 'TypeScript',
    database: 'SQLite via better-sqlite3',
    styling: 'Tailwind CSS',
    testing: 'Vitest',
  },
  scripts: pkg.scripts,
  directories: ['app', 'components', 'lib', 'tests', 'docs', '.codex', '.kiro', '.idea']
    .filter((dir) => fs.existsSync(path.join(root, dir)))
    .map((dir) => ({ path: dir, description: describeDirectory(dir) })),
  keyFiles,
  routes: {
    pages: pageRoutes,
    api: apiRoutes,
  },
  modules: {
    components: componentFiles,
    lib: libFiles,
  },
  database: db,
  ai: {
    runtimeSkillLoader: 'lib/skills.ts reads and writes .codex/skills/*/SKILL.md',
    codexSkillsDir: '.codex/skills/* is the single source of truth for runtime and Codex skill discovery',
    skills,
    legacy: {
      kiroFiles,
      ideaFiles,
    },
  },
  docs: docsFiles,
  tests: {
    files: testFiles,
    count: testFiles.length,
  },
};

const brief = `# Codex Project Brief

Generated: ${generatedAt}

## Snapshot

- App: \`${cache.project.name}\` (${cache.project.framework}, ${cache.project.language})
- Data/auth: SQLite via \`lib/db.ts\`; auth in \`lib/auth.ts\` and \`middleware.ts\`
- UI: Tailwind CSS in a Next.js 14 App Router app
- Tests: Vitest under \`tests/\`; e2e via Playwright
- Runtime skills: \`.codex/skills/*/SKILL.md\` loaded by \`lib/skills.ts\`

## Load Policy

- Read this brief first for normal tasks.
- Open \`.codex/cache/project-context.md\` only when route/module/database detail is needed.
- Open \`.codex/cache/project-context.json\` only when structured inventories are needed.
- Open \`.codex/cache/legacy-summary.md\` only for Claude, Kiro, or IDE migration provenance.
- Open individual \`.codex/skills/*/SKILL.md\` files only when that skill is relevant.

## Main Surfaces

- Public pages: blog, files, login, tools, homepage.
- Admin pages: AI config, blog editor, diary, files/albums, skills, subscriptions, tools, X posting, Claude Code worker.
- API groups: AI chat/providers/skills, blog, diary, files/albums/uploads, subscriptions, todos, fortune/BaZi, X auth/posting, Claude Code worker.

## Workflow

- Refresh cache after structural changes: \`npm run codex:cache\`
- Normalize runtime skills after skill structure changes: \`npm run codex:skills\`
- For API/interface changes, add or update Vitest coverage before implementation.
- For broad architecture, style, workflow, or UI changes, run \`npm run lint\`.
- For release-sized changes, run \`npm run verify\` or \`npm run verify:large\` as appropriate.
`;

const md = `# Codex Project Context

Generated: ${generatedAt}

## Snapshot

- Name: \`${cache.project.name}\`
- Stack: Next.js 14 App Router, TypeScript, SQLite, Tailwind CSS, Vitest
- Package manager: \`${cache.project.packageManager}\`
- Primary runtime skill source: \`.codex/skills\`
- Cache refresh command: \`npm run codex:cache\`

## Main Directories

${cache.directories.map((dir) => `- \`${dir.path}\`: ${dir.description}`).join('\n')}

## Key Files

${keyFiles.map((file) => `- \`${file.file}\`: ${file.description}`).join('\n')}

## Page Routes (${pageRoutes.length})

${pageRoutes.map((route) => `- \`${route.route}\` -> \`${route.file}\`: ${route.description}`).join('\n')}

## API Routes (${apiRoutes.length})

${apiRoutes.map((route) => `- \`${route.route}\` -> \`${route.file}\`: ${route.description}`).join('\n')}

## Database

- File: \`data/site.db\`
- Tables: ${db.tables.map((table) => `\`${table}\``).join(', ')}
- PRAGMA settings: ${db.pragmas.map((pragma) => `\`${pragma}\``).join(', ')}
- Simple migrations: ${db.migrations.length ? db.migrations.map((m) => `\`${m.table}.${m.column}\``).join(', ') : 'none detected'}
- Prepared statements: ${db.preparedStatements.length ? db.preparedStatements.map((stmt) => `\`${stmt}\``).join(', ') : 'none detected'}

## AI Skills (${skills.length})

${skills.map((skill) => `- \`${skill.id}\`: ${skill.description || 'No description in frontmatter.'}${skill.hasScripts ? ' Includes scripts.' : ''}${skill.hasReferences ? ' Includes references.' : ''}`).join('\n')}

## Legacy Assistant Assets

- Kiro files: ${kiroFiles.length}
- IDEA files: ${ideaFiles.length}

## Tests

- API and helper test files: ${testFiles.length}
- Examples: ${testFiles.slice(0, 8).map((file) => `\`${file}\``).join(', ')}

## Notes

- \`.codex/skills/\` is both the application runtime skill source and the Codex skill catalog.
- \`.idea/\` is tracked only as provenance; it is not treated as meaningful architecture memory.
- Read \`.codex/cache/legacy-summary.md\` if a task mentions Claude, Kiro, or IDE migration details.
`;

fs.writeFileSync(path.join(cacheDir, 'project-brief.md'), brief);
fs.writeFileSync(path.join(cacheDir, 'project-context.json'), `${JSON.stringify(cache, null, 2)}\n`);
fs.writeFileSync(path.join(cacheDir, 'project-context.md'), md);

console.log(`Codex cache refreshed at ${generatedAt}`);
