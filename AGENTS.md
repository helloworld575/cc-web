# Codex Working Guide

Read these files first before scanning the repository:

1. `.codex/cache/project-context.md`
2. `.codex/cache/project-context.json`
3. `.codex/cache/legacy-summary.md`

This repository is a Next.js 14 App Router application backed by SQLite. It mixes a personal blog with internal tools: diary, todos, file albums, AI chat, subscriptions, X posting, and Chinese fortune workflows.

## Source Of Truth

- Runtime AI skills now live in `.codex/skills/` and are loaded by `lib/skills.ts`.
- `npm run codex:skills` normalizes `.codex/skills/` metadata and prompt contracts in place.
- Database schema, migrations, and prepared statements live in `lib/db.ts`.
- Auth and admin protection are split between `lib/auth.ts` and `middleware.ts`.
- Tests under `tests/api/` are the expected safety net for API changes.

## Codex Cache

- `.codex/cache/project-context.md` is the human-readable project memory.
- `.codex/cache/project-context.json` is the machine-readable cache.
- Refresh both after structural changes with `npm run codex:cache`.

## Working Rules

- Prefer the cache files above before re-reading broad parts of the repo.
- When a user request contains multiple requirements, immediately split it into small concrete requirements before implementation.
- Classify each requirement before editing:
  - Large change: user-visible feature, API/interface change, auth/data/streaming behavior, major refactor, deployment or workflow behavior. Run API tests and affected e2e tests before commit or deploy.
  - Small change: narrow API/server/helper adjustment with limited UI impact. Run relevant API tests before commit or deploy.
  - Other change: docs, copy, cache, comments, or non-behavioral metadata. No dedicated test run is required unless bundled with a large or small change.
- Do not commit, push, or deploy until the required tests for the largest included change class have passed.
- Keep `.codex/skills/` as the single source of truth for both runtime and Codex discovery.
- When `.codex/skills/` changes structurally, rerun `npm run codex:skills` to normalize metadata and prompt contracts.
- Routes that touch SQLite, filesystem, or streaming should stay on `runtime = 'nodejs'`.
- Styling is Tailwind-first; do not introduce CSS modules unless the repo direction changes.
- New or changed API routes should be covered by Vitest tests in `tests/api/`.
- TDD is the default delivery mode in this repo: use `red -> green -> refactor`, not "implement first, patch tests later".
- Any API or interface change must begin with a failing test before implementation work starts.
  API/interface changes include request and response contracts, auth behavior, status codes, streaming behavior, and externally visible data side effects.
- For API work, add or update the relevant Vitest coverage in `tests/api/` or the nearest focused test file before editing the route implementation.
- For large changes, major refactors, or architecture work, the task is not complete until:
  1. `npm test` passes
  2. the affected end-to-end flow has been exercised by e2e automation
- If an affected user flow has no committed e2e coverage yet, add or update that e2e path as part of the same task rather than silently waiving the requirement.
- In completion messages, explicitly state which test-first coverage was added and which npm/e2e validations were run. If required e2e validation could not be executed, treat it as an open blocker.
- When behavior, operations, deployment, or developer workflow changes, update the affected README/docs in the same change set instead of leaving documentation drift behind.
- Completed change sets should not remain local-only: commit them and push them to the configured Git remote before treating the task as done.
- Only use `deploy-to-nas.sh` for large or release-worthy changes, or when the user explicitly asks for NAS deployment. Small changes stop at Git push.
- Long-running local validation flows that open ports or background processes should use `scripts/run-managed-command.mjs` or an equivalent managed wrapper so logs land under `log/automation/` and designated ports are cleared on exit.
- After tests, e2e runs, or NAS deployment, shut down spawned servers and background processes, free reserved ports, close SSH/SFTP sessions, and remove temporary staging artifacts before marking the work complete.
