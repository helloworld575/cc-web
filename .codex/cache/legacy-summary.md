# Legacy To Codex Mapping

This repository already contained assistant- and IDE-specific folders before Codex adaptation. They are preserved for compatibility, but Codex should treat them through the normalized cache in this directory.

## `.claude`

- `.claude/skills/` is still runtime-critical.
- The web app loads skills directly from `.claude/skills/<skill>/SKILL.md` via `lib/skills.ts`.
- Codex should not rename or delete this path unless the loader is updated at the same time.
- `.codex/skills/` now contains Codex-native mirrors generated from `.claude/skills/` with `npm run codex:skills`.
- The skill inventory is cached into `project-context.json` and summarized in `project-context.md`.

## `.claude/plans`

- Historical implementation notes only.
- Useful for background context, but not part of active runtime behavior.
- Codex cache records their existence so they do not need to be rediscovered each turn.

## `.kiro`

- `.kiro/steering/ai.md` is a legacy AI feature summary focused on the old Claude-centered workflow.
- Its value has been folded into the Codex cache as part of the project and skill summaries.

## `.idea`

- `.idea/` only contains IDE metadata such as module and VCS settings.
- These files are intentionally not expanded into detailed Codex memory because they carry little architectural value.
- Codex cache only records the file inventory for provenance.

## Codex Entry Points

- `AGENTS.md` is the top-level Codex working guide.
- `.codex/cache/project-context.md` is the fast path for human reading.
- `.codex/cache/project-context.json` is the fast path for machine parsing or scripted refresh.
