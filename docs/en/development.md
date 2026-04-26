# Development Guide

How to set up, develop, and deploy this site.

## Tech Stack

- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via `better-sqlite3`
- **Auth**: NextAuth.js (credentials provider)
- **Styling**: Tailwind CSS + `@tailwindcss/typography`
- **Markdown**: `react-markdown` + `gray-matter` for frontmatter
- **Editor**: `@uiw/react-md-editor`
- **Testing**: Vitest with node env
- **Deploy**: Docker + Cloudflared tunnel (for NAS)

## Project Structure

```
my-site/
├── app/                     # Next.js App Router
│   ├── api/                 # API routes
│   ├── admin/               # Admin pages (gated by middleware)
│   ├── blog/                # Public blog pages
│   ├── tools/               # Tools page (todos, diary, fortune, chat, subs)
│   └── layout.tsx
├── components/              # Shared React components
├── lib/                     # Server-side utilities
│   ├── db.ts                # SQLite connection + prepared statements
│   ├── auth.ts              # NextAuth config
│   ├── skills.ts            # Skill loader from .codex/skills/
│   ├── fetchers.ts          # Subscription content fetchers
│   ├── xapi.ts              # X/Twitter OAuth 1.0a + media upload
│   └── i18n.ts              # EN/ZH translations
├── .codex/skills/           # AI skills (runtime source + Codex catalog)
├── content/posts/           # Blog markdown files
├── uploads/                 # User-uploaded images
├── data/site.db             # SQLite database
├── tests/                   # Vitest tests
└── middleware.ts            # Auth + rate limit middleware
```

## Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env template and fill in values:
   ```bash
   cp .env.example .env.local
   ```
4. Required env vars:
   - `ADMIN_PASSWORD` — login password; use a strong value (`changeme` is blocked in production)
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — e.g., `http://localhost:3000`
5. Optional but recommended:
   - AI provider vars (can also be set via Admin UI)
   - `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` for posting to X

6. Start dev server:
   ```bash
   npm run dev
   ```

## Database

SQLite schema is defined inline in `lib/db.ts`. On first run, all tables are created if not present.

Tables:
- `todos`, `files`, `albums`, `diary`, `fortune_history`
- `ai_providers`, `ai_chat_history`
- `subscription_sources`, `subscription_briefs`

Prepared statements are exported from `lib/db.ts` via `stmts` for performance.

Use `sqlite3 data/site.db` to inspect directly.

## TDD Policy

For meaningful work in this repo, default to TDD:

1. Red: write or update a failing test that captures the required behavior or regression
2. Green: implement the smallest change that makes the test pass
3. Refactor: improve the design while keeping the tests green

Rules:
- Any API or interface change must begin with a test change before implementation.
- API/interface changes include request or response contracts, auth rules, status codes, streaming behavior, and externally visible data side effects.
- For route work, place or extend coverage in `tests/api/` unless a more specific nearby test file is the better fit.
- Large refactors and architecture changes are not done until both `npm test` and the affected e2e flow pass.
- If there is no committed e2e for an affected user flow yet, add or update that e2e path as part of the same task rather than skipping it.

## Operational Workflow

- If a change affects behavior, operations, testing, or deployment, update the relevant README/docs in the same change set.
- Completed change sets should be committed and pushed to Git instead of being left only in the local worktree.
- Run the quality gates that match the size of the change:
  ```bash
  npm run lint          # format, architecture, and TypeScript checks
  npm run verify        # lint + Vitest + production build
  npm run verify:large  # verify + full Playwright e2e suite
  ```
- `npm run lint:architecture` enforces executable project boundaries, including Node runtime declarations for SQLite/filesystem/streaming routes, Edge-safe middleware, Tailwind-first styling, and `.codex/skills/` as the skill source of truth.
- Use `.codex/agents/architecture-reviewer.md` for dedicated architecture/style audits and context cleanup.
- Reserve `./deploy-to-nas.sh` for large or release-worthy changes. Small changes usually stop after Git push.
- Long-running local test and smoke flows should use the managed runner so logs are captured and cleanup is enforced:
  ```bash
  npm run dev:managed
  npm run test:managed
  node scripts/run-managed-command.mjs --label e2e-local --clear-port 3000 -- <your-e2e-command>
  ```
- Managed local logs are written to `log/automation/`. NAS deploy logs are written to `log/deploy/`.
- After tests, e2e runs, or NAS deployment, shut down spawned processes, free dedicated test ports, close SSH/SFTP sessions, and remove temporary staging artifacts before calling the task done.

## Adding a New Feature

### 1. Add an API route

Create `app/api/<name>/route.ts`:

```typescript
export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'my-feature', 20);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ... logic
  return Response.json({ ok: true });
}
```

### 2. Add an admin page

Create `app/admin/<feature>/page.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';

export default function MyFeaturePage() {
  // ... UI
}
```

Add a nav link in `app/admin/layout.tsx`.

### 3. Write tests first

Create `tests/api/<name>/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

describe('POST /api/my-feature', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/my-feature/route');
    const res = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });
});
```

Write the test to fail first, then implement the route, then rerun `npm test`.

## Adding an AI Skill

1. Create `.codex/skills/<skill-name>/SKILL.md`:

```yaml
---
name: my-skill
description: When to trigger this skill (must be specific — affects AI routing)
user_invocable: true
system: "System prompt"
prompt: "User prompt with {{content}} placeholder"
output: content
---

# My Skill

Human-readable explanation of the skill.
```

2. Optional: bundle scripts in `scripts/` or references in `references/`
3. Regenerate the Codex mirrors:

   ```bash
   npm run codex:skills
   ```

4. Use it from code:

```typescript
import { getSkill } from '@/lib/skills';
const skill = getSkill('my-skill');
// skill.system, skill.prompt, skill.output
```

The web app runtime source of truth is `.codex/skills/`. Run `npm run codex:skills` after structural edits so frontmatter and prompt contracts stay normalized for both the app and Codex.

## Testing

```bash
npm test                 # Run all tests once
npm run test:managed     # Run tests with timestamped logging
npm run e2e              # Run Playwright e2e against the isolated runtime
npm run e2e:headed       # Same suite with a visible browser
npm run test:watch       # Watch mode
```

Repository policy:
- API changes are test-first by default.
- Large or architecture-level changes must pass both `npm test` and the relevant e2e flow before they are considered complete.
- If the repo lacks e2e coverage for the changed user flow, the change should add or update that coverage instead of waiving the check.
- The Playwright suite boots a dedicated Next dev server on port `3001`, seeds `.tmp/e2e-runtime`, and enables `E2E_MOCK_STREAMS=1` so streaming UI can be validated without live provider calls.
- Use the managed scripts instead of raw long-running commands so ports, child processes, and temporary artifacts are cleaned up automatically.

The test setup (`tests/setup.ts`) mocks:
- `better-sqlite3` (all `db.prepare().*` return vitest mocks)
- `next-auth` (`getServerSession`)
- `@/lib/rateLimit`, `@/lib/fetchers`, `@/lib/xapi`

Use helpers in `tests/helpers.ts`:
- `mockSession(true|false)` — set auth state
- `mockDbStmt({get, all, run})` — set DB statement return values
- `mockRateLimit429()` — force rate limit response
- `postReq(body)` — build a POST Request
- `mockStreamResponse(fetch)` — mock SSE streaming response

## Deployment

### Docker (local/NAS)

```bash
docker-compose up -d
```

See `Dockerfile` and `docker-compose.yml`.

### NAS with Cloudflared tunnel

```bash
./deploy-to-nas.sh
```

Required deploy vars live in the root `.env.local`:
- `NAS_HOST`
- `NAS_USER`
- `NAS_PATH`
- `NAS_PASSWORD`
- `CLOUDFLARE_TUNNEL_TOKEN`

The script uploads `.env.local` and `docker-compose.nas.yml`, builds `my-site:latest` on the NAS, then runs `docker compose --env-file .env.local -f docker-compose.nas.yml up -d`.
It also writes a timestamped deploy log to `log/deploy/`, removes the remote staging directory, and closes SSH/SFTP sessions before exiting.

## Code Style

- TypeScript strict mode
- No emojis unless user asks
- Keep bundle size small — prefer native APIs over libraries
- Use `export const runtime = 'nodejs'` on API routes that use Node.js APIs (db, fs)
- Tailwind for styling — no CSS modules
- Always add tests for new API routes (auth check + happy path + error case)

## Common Gotchas

- `better-sqlite3` is native — can only be used in Node runtime, not Edge middleware
- `useLocale` hook uses cookies — wrap locale-dependent UI in `suppressHydrationWarning` to avoid SSR mismatches
- API routes that use streaming (`text/event-stream`) need `runtime = 'nodejs'` and proper ReadableStream handling
- The `.codex/skills/` directory is used by both the web app (`lib/skills.ts`) and Codex skill discovery — keep skills compatible with both
