# Codex Working Guide

Read these files first before scanning the repository:

1. `.codex/cache/project-context.md`
2. `.codex/cache/project-context.json`
3. `.codex/cache/legacy-summary.md`

This repository is a Next.js 14 App Router application backed by SQLite. It mixes a personal blog with internal tools: diary, todos, file albums, AI chat, subscriptions, X posting, and Chinese fortune workflows.

## Source Of Truth

- Runtime AI skills still live in `.claude/skills/` and are loaded by `lib/skills.ts`.
- Codex-native skill mirrors live in `.codex/skills/` and are generated from `.claude/skills/` with `npm run codex:skills`.
- Database schema, migrations, and prepared statements live in `lib/db.ts`.
- Auth and admin protection are split between `lib/auth.ts` and `middleware.ts`.
- Tests under `tests/api/` are the expected safety net for API changes.

## Codex Cache

- `.codex/cache/project-context.md` is the human-readable project memory.
- `.codex/cache/project-context.json` is the machine-readable cache.
- Refresh both after structural changes with `npm run codex:cache`.

## Working Rules

- Prefer the cache files above before re-reading broad parts of the repo.
- Keep `.claude/skills/` compatible unless you intentionally update `lib/skills.ts`.
- When `.claude/skills/` changes, regenerate the Codex mirrors with `npm run codex:skills`.
- Routes that touch SQLite, filesystem, or streaming should stay on `runtime = 'nodejs'`.
- Styling is Tailwind-first; do not introduce CSS modules unless the repo direction changes.
- New or changed API routes should be covered by Vitest tests in `tests/api/`.
