# Codex Layer

This directory is the Codex-native memory layer for this repository.

Files:

- `cache/project-context.md`: compact human summary of the current project.
- `cache/project-context.json`: structured cache for routes, modules, tables, tests, and legacy assistant assets.
- `cache/legacy-summary.md`: mapping from `.claude`, `.kiro`, and `.idea` into Codex-oriented context.
- `agents/architecture-reviewer.md`: reusable reviewer instructions for architecture/style audits and context cleanup.
- `skills/`: Codex-native mirrors of `.claude/skills/` for local Codex discovery.

Refresh with:

```bash
npm run codex:skills
npm run codex:cache
```
