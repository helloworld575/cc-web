# Codex Project Context

Generated: 2026-07-07T16:40:24.452Z

## Snapshot

- Name: `my-site`
- Stack: Next.js 14 App Router, TypeScript, SQLite, Tailwind CSS, Vitest
- Package manager: `npm`
- Primary runtime skill source: `.codex/skills`
- Cache refresh command: `npm run codex:cache`

## Main Directories

- `app`: Next.js App Router pages, layouts, and API routes.
- `components`: Shared client and server React components.
- `lib`: Server-side helpers for auth, SQLite, AI skills, fetchers, i18n, X integration, and fortune logic.
- `tests`: Vitest coverage, mainly for API routes.
- `docs`: English and Chinese user/development/API documentation.
- `.codex`: Codex-native cache, guidance, and the runtime AI skill catalog.

## Key Files

- `AGENTS.md`: Codex working guide for repository-specific workflow and constraints.
- `middleware.ts`: Edge middleware for admin auth protection and auth-route rate limiting.
- `package.json`: Project metadata and npm scripts for Next.js, Vitest, and Codex cache refresh.
- `next.config.mjs`: Next.js configuration.
- `tailwind.config.ts`: Tailwind theme configuration.
- `lib/db.ts`: SQLite connection, schema bootstrap, light migrations, indexes, and prepared statements.
- `lib/auth.ts`: NextAuth credentials configuration and session helpers.
- `lib/skills.ts`: Reads and writes runtime AI skills from .codex/skills.
- `lib/fetchers.ts`: Subscription source fetchers and content normalization helpers.
- `lib/xapi.ts`: X/Twitter API integration and media upload helpers.
- `lib/i18n.ts`: Localization strings and locale helpers.
- `app/layout.tsx`: Root layout, global shell, and shared providers.
- `app/page.tsx`: Homepage entry point.
- `app/tools/page.tsx`: Tool hub entry page.
- `app/admin/layout.tsx`: Admin shell and protected navigation.
- `app/api/ai/route.ts`: Generic AI skill execution route.
- `app/api/ai-chat/route.ts`: Streaming AI chat session management.
- `app/api/ai-providers/route.ts`: Read-only env-backed AI provider listing.
- `app/api/blog/route.ts`: Blog collection API.
- `app/api/blog/[slug]/route.ts`: Single-post blog API.
- `app/api/files/route.ts`: Uploaded file metadata API.
- `app/api/uploads/[...path]/route.ts`: Uploaded file streaming endpoint.
- `app/api/subscriptions/route.ts`: Subscription source CRUD.
- `app/api/subscriptions/crawl/route.ts`: Crawl subscription content into raw stored items.
- `app/api/subscriptions/integrate/route.ts`: Generate briefs from stored subscription items.
- `app/api/subscriptions/fetch/route.ts`: Compatibility alias for subscription integration.
- `app/api/subscriptions/briefs/route.ts`: Subscription brief retrieval.
- `app/api/fortune/route.ts`: Streaming fortune analysis route with history integration.
- `app/api/bazi/route.ts`: Dedicated BaZi streaming route.

## Page Routes (16)

- `/admin/ai-config` -> `app/admin/ai-config/page.tsx`: Admin page for AI provider configuration.
- `/admin/blog/[slug]` -> `app/admin/blog/[slug]/page.tsx`: Admin editor for a single blog post.
- `/admin/blog` -> `app/admin/blog/page.tsx`: Admin blog list/editor entry.
- `/admin/claude-code` -> `app/admin/claude-code/page.tsx`: Page route in the Next.js App Router tree.
- `/admin/diary` -> `app/admin/diary/page.tsx`: Diary management page.
- `/admin/files` -> `app/admin/files/page.tsx`: File and album management page.
- `/admin/skills` -> `app/admin/skills/page.tsx`: Admin skill management UI.
- `/admin/subscriptions` -> `app/admin/subscriptions/page.tsx`: Subscription source and brief management.
- `/admin/tools` -> `app/admin/tools/page.tsx`: Admin tool dashboard.
- `/admin/x-post` -> `app/admin/x-post/page.tsx`: Publish content to X/Twitter.
- `/blog/[slug]` -> `app/blog/[slug]/page.tsx`: Single blog post page.
- `/blog` -> `app/blog/page.tsx`: Public blog index.
- `/files` -> `app/files/page.tsx`: Public or shared file listing page.
- `/login` -> `app/login/page.tsx`: Credentials login page.
- `/` -> `app/page.tsx`: Public homepage.
- `/tools` -> `app/tools/page.tsx`: Main tool hub.

## API Routes (34)

- `/api/ai-chat/[id]` -> `app/api/ai-chat/[id]/route.ts`: Read, update, or delete stored AI chat sessions.
- `/api/ai-chat` -> `app/api/ai-chat/route.ts`: Create and stream AI chat sessions.
- `/api/ai-image` -> `app/api/ai-image/route.ts`: API route in the application backend.
- `/api/ai-providers/[id]` -> `app/api/ai-providers/[id]/route.ts`: Read a single env-backed AI provider.
- `/api/ai-providers` -> `app/api/ai-providers/route.ts`: List env-backed AI providers.
- `/api/ai-providers/test` -> `app/api/ai-providers/test/route.ts`: Test an AI provider with a non-streaming call.
- `/api/ai` -> `app/api/ai/route.ts`: Execute reusable AI skills against submitted content.
- `/api/albums/[id]` -> `app/api/albums/[id]/route.ts`: Single-album operations.
- `/api/albums` -> `app/api/albums/route.ts`: Album CRUD for uploaded files.
- `/api/auth/[...nextauth]` -> `app/api/auth/[...nextauth]/route.ts`: NextAuth credentials endpoint.
- `/api/bazi` -> `app/api/bazi/route.ts`: Specialized BaZi analysis endpoint.
- `/api/blog/[slug]` -> `app/api/blog/[slug]/route.ts`: Read, update, or delete a single blog post.
- `/api/blog` -> `app/api/blog/route.ts`: List or create blog content.
- `/api/claude-code` -> `app/api/claude-code/route.ts`: API route in the application backend.
- `/api/diary/[id]` -> `app/api/diary/[id]/route.ts`: Single diary entry operations.
- `/api/diary` -> `app/api/diary/route.ts`: Diary entry CRUD.
- `/api/files/[id]` -> `app/api/files/[id]/route.ts`: Single file operations.
- `/api/files` -> `app/api/files/route.ts`: File metadata CRUD.
- `/api/fortune/history/[id]` -> `app/api/fortune/history/[id]/route.ts`: Read or delete a single fortune record.
- `/api/fortune/history` -> `app/api/fortune/history/route.ts`: Fortune history listing and creation.
- `/api/fortune` -> `app/api/fortune/route.ts`: General fortune workflow with streaming response.
- `/api/skills/[id]` -> `app/api/skills/[id]/route.ts`: Read, update, or delete a single skill.
- `/api/skills` -> `app/api/skills/route.ts`: List and manage web-app AI skills.
- `/api/subscriptions/[id]` -> `app/api/subscriptions/[id]/route.ts`: Single subscription source operations.
- `/api/subscriptions/briefs` -> `app/api/subscriptions/briefs/route.ts`: List stored subscription briefs.
- `/api/subscriptions/crawl` -> `app/api/subscriptions/crawl/route.ts`: Fetch remote subscription content into raw stored items without AI.
- `/api/subscriptions/fetch` -> `app/api/subscriptions/fetch/route.ts`: Compatibility alias for subscription integration.
- `/api/subscriptions/integrate` -> `app/api/subscriptions/integrate/route.ts`: Generate subscription briefs from stored crawl items.
- `/api/subscriptions` -> `app/api/subscriptions/route.ts`: Manage subscription sources.
- `/api/todos/[id]` -> `app/api/todos/[id]/route.ts`: Single todo operations.
- `/api/todos` -> `app/api/todos/route.ts`: Todo CRUD.
- `/api/uploads/[...path]` -> `app/api/uploads/[...path]/route.ts`: Stream uploaded files from disk.
- `/api/x-auth` -> `app/api/x-auth/route.ts`: X/Twitter authentication flow.
- `/api/x-post` -> `app/api/x-post/route.ts`: Publish generated content to X/Twitter.

## Database

- File: `data/site.db`
- Tables: `todos`, `files`, `albums`, `diary`, `fortune_history`, `ai_providers`, `ai_chat_history`, `subscription_sources`, `subscription_briefs`, `subscription_items`
- PRAGMA settings: `journal_mode = WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`, `cache_size = -8000`, `temp_store = MEMORY`, `mmap_size = 67108864`, `page_size = 4096`
- Simple migrations: `todos.deadline`, `files.album_id`
- Prepared statements: `countFiles`, `listFiles`, `insertFile`, `listFortune`, `insertFortune`, `getFortune`, `deleteFortune`, `listProviders`, `getProvider`, `insertProvider`, `updateProvider`, `deleteProvider`, `clearDefaultProvider`, `listChats`, `listChatsByProvider`, `getChat`, `insertChat`, `updateChat`, `deleteChat`

## AI Skills (52)

- `agent-browser`: >-
- `agent-router`: >-
- `api-blog-image-publisher`: Prepare API-ready plans for publishing blog posts and sending images.
- `arming-thought`: >
- `article-brief`: Generate a short excerpt or summary teaser for a blog post.
- `article-faq`: Generate a reader-facing FAQ section for an article.
- `article-polish`: Rewrite and polish article copy for clarity and engagement.
- `article-structure`: Restructure an article to improve flow and readability.
- `article-tags`: Extract high-value tags and keywords for a post.
- `article-title`: Generate SEO-friendly headline or title options.
- `article-translate-en`: Translate Chinese article content into natural English.
- `bazi-fortune`: BaZi / Four Pillars fortune analysis skill with helper scripts. Includes scripts.
- `blog-to-x`: Convert long-form blog or diary content into X/Twitter posts or threads. Includes references.
- `business-router`: >-
- `company-values`: >-
- `concentrate-forces`: >
- `content-router`: >-
- `contradiction-analysis`: >
- `criticism-self-criticism`: >
- `find-community`: >-
- `find-skills`: >-
- `first-customers`: >-
- `fortune-router`: >-
- `grow-sustainably`: >-
- `investigation-first`: >
- `knowledge-router`: >-
- `liuyao-fortune`: Liu Yao / I Ching divination skill with helper scripts. Includes scripts.
- `marketing-plan`: >-
- `mass-line`: >
- `meihua-fortune`: Meihua Yishu numerology divination skill with helper scripts. Includes scripts.
- `memory-systems`: > Includes scripts. Includes references.
- `minimalist-review`: >-
- `mvp`: >-
- `overall-planning`: >
- `practice-cognition`: >
- `pricing`: >-
- `processize`: >-
- `protracted-strategy`: >
- `research`: >
- `skill-creator`: >- Includes scripts. Includes references.
- `skill-tree-root`: >-
- `source-credibility-check`: Evaluate fetched sources for reliability, freshness, conflicts, and verification needs.
- `spark-prairie-fire`: >
- `strategy-router`: >-
- `subscription`: Summarize the latest updates from subscribed sources such as blogs, GitHub, X, RSS, or Reddit. Includes scripts. Includes references.
- `summarize`: >-
- `tmux`: >- Includes scripts.
- `validate-idea`: >-
- `web-research-brief`: Summarize fetched web, RSS, search, or crawler output into a source-grounded research brief.
- `webapp-testing`: >- Includes scripts.
- `workflows`: >
- `ziwei-fortune`: Zi Wei Dou Shu astrology analysis skill with helper scripts. Includes scripts.

## Legacy Assistant Assets

- Kiro files: 0
- IDEA files: 0

## Tests

- API and helper test files: 36
- Examples: `tests/api/ai-chat/id.test.ts`, `tests/api/ai-chat/route.test.ts`, `tests/api/ai-image/route.test.ts`, `tests/api/ai-providers/id.test.ts`, `tests/api/ai-providers/route.test.ts`, `tests/api/ai-providers/test.test.ts`, `tests/api/ai/route.test.ts`, `tests/api/bazi/route.test.ts`

## Notes

- `.codex/skills/` is both the application runtime skill source and the Codex skill catalog.
- `.idea/` is tracked only as provenance; it is not treated as meaningful architecture memory.
- Read `.codex/cache/legacy-summary.md` if a task mentions Claude, Kiro, or IDE migration details.
