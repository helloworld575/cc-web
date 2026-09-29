# Codex Layer

This directory contains the repository context, reviewer instructions, and shared skill catalog.

Files:

- `cache/project-brief.md`: compact startup context; read this first.
- `cache/project-context.md`: detailed project inventory, loaded when needed.
- `cache/project-context.json`: structured cache for routes, modules, tables, tests, and legacy assistant assets.
- `cache/legacy-summary.md`: mapping from `.claude`, `.kiro`, and `.idea` into Codex-oriented context.
- `agents/architecture-reviewer.md`: reusable reviewer instructions for architecture/style audits and context cleanup.
- `skills/`: the single source of truth for runtime skills loaded by `lib/skills.ts` and local Codex discovery.

After structural skill changes, normalize metadata and refresh the generated context:

```bash
npm run codex:skills
npm run codex:cache
```

Validate the catalog with `npm run lint:architecture` (also included in `npm run lint`). It rejects empty catalogs, malformed metadata, missing skill references, duplicate child routes, cycles, and invalid invocable prompt/output contracts. Roots and routers must have child routes; leaves must not. A child edge using `mode: route` must lead to a skill with child routes.

Omitted orchestration fields retain their inferred defaults. Explicit malformed values are reported instead of silently replaced. Skills marked `invocable: true` need non-empty `prompt` and `output` fields; routing and reference skills may remain non-invocable. The normalizer preserves existing `agents/openai.yaml` settings.

For agent or catalog changes, add focused regression tests in `tests/scripts/` or `tests/lib/` as appropriate. Use the validation gates in `AGENTS.md`; `npm run verify:large` includes the skills finder and assistant conversation e2e flows. The architecture reviewer operates read-only and reports evidence-backed findings for the implementing agent.
