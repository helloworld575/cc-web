# Legacy To Codex Mapping

This repository started with Claude-specific assets, but the skill runtime has now been consolidated into `.codex/skills/`. Treat this file as migration background, not as an active runtime contract.

## `.claude`

- As of 2026-04-23, `.claude/skills/` is no longer part of the application runtime.
- Runtime skills, Codex-discoverable skills, and admin-managed app skills now all live in `.codex/skills/`.
- `npm run codex:skills` normalizes `.codex/skills/` in place instead of mirroring from another directory.

## `.kiro`

- `.kiro/steering/ai.md` is a legacy AI feature summary from an earlier workflow.
- Its useful architectural context should be reflected through `.codex/cache/project-context.*` instead of being treated as live instructions.

## `.idea`

- `.idea/` only contains IDE metadata such as module and VCS settings.
- These files are intentionally not expanded into detailed Codex memory because they carry little architectural value.
- Codex cache only records the file inventory for provenance.

## Codex Entry Points

- `AGENTS.md` is the top-level Codex working guide.
- `.codex/cache/project-context.md` is the fast path for human reading.
- `.codex/cache/project-context.json` is the fast path for machine parsing or scripted refresh.
