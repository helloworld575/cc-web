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
│   ├── skills.ts            # Skill loader from .claude/skills/
│   ├── fetchers.ts          # Subscription content fetchers
│   ├── xapi.ts              # X/Twitter OAuth 1.0a + media upload
│   └── i18n.ts              # EN/ZH translations
├── .claude/skills/          # AI skills (used by web app + Claude Code)
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
   - `ADMIN_PASSWORD` — login password
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

### 3. Write tests

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

Run: `npm test`

## Adding an AI Skill

1. Create `.claude/skills/<skill-name>/SKILL.md`:

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
3. Use it from code:

```typescript
import { getSkill } from '@/lib/skills';
const skill = getSkill('my-skill');
// skill.system, skill.prompt, skill.output
```

## Testing

```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode
```

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

Uses `docker-compose.nas.yml` — mounts volumes for `data/`, `uploads/`, `content/`.
Cloudflared tunnel token goes in `CLOUDFLARE_TUNNEL_TOKEN` env var.

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
- The `.claude/skills/` directory is used by both the web app (`lib/skills.ts`) and Claude Code — keep skills compatible with both
