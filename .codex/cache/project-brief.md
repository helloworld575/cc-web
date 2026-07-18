# Codex Project Brief

Generated: 2026-07-18T11:51:20.109Z

## Snapshot

- App: `my-site` (Next.js 16 App Router, TypeScript)
- Data/auth: SQLite via `lib/db.ts`; auth in `lib/auth.ts` and `proxy.ts`
- UI: Tailwind CSS in a Next.js 16 App Router app
- Tests: Vitest under `tests/`; e2e via Playwright
- Runtime skills: `.codex/skills/*/SKILL.md` loaded by `lib/skills.ts`

## Load Policy

- Read this brief first for normal tasks.
- Open `.codex/cache/project-context.md` only when route/module/database detail is needed.
- Open `.codex/cache/project-context.json` only when structured inventories are needed.
- Open `.codex/cache/legacy-summary.md` only for Claude, Kiro, or IDE migration provenance.
- Open individual `.codex/skills/*/SKILL.md` files only when that skill is relevant.

## Main Surfaces

- Public pages: blog, files, login, tools, homepage.
- Admin pages: AI config, blog editor, diary, files/albums, skills, subscriptions, tools, X posting, Claude Code worker.
- API groups: AI chat/providers/skills, blog, diary, files/albums/uploads, subscriptions, todos, fortune/BaZi, X auth/posting, Claude Code worker.

## Workflow

- Refresh cache after structural changes: `npm run codex:cache`
- Normalize runtime skills after skill structure changes: `npm run codex:skills`
- For API/interface changes, add or update Vitest coverage before implementation.
- For broad architecture, style, workflow, or UI changes, run `npm run lint`.
- For release-sized changes, run `npm run verify` or `npm run verify:large` as appropriate.
