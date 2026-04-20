---
name: article-polish
description: "Rewrite and polish article copy for clarity and engagement. Use when Codex needs to improve wording, flow, tone, or readability without changing the core meaning."
---

This skill mirrors `.claude/skills/article-polish` for Codex. Keep `.claude/skills/article-polish/SKILL.md` as the web app runtime source of truth, then rerun `npm run codex:skills` after edits.

# Polish Article

Deep rewrite to make the article more engaging, structured, and professional while preserving the author's voice.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Editing Principles

1. **Clarity first** — Every sentence must earn its place. Cut filler, tighten prose.
2. **Strong openings** — The first paragraph must hook the reader immediately.
3. **Logical flow** — Ideas progress naturally. Add transitions where needed.
4. **Active voice** — Convert passive constructions to active wherever possible.
5. **Concrete over abstract** — Replace vague statements with specific examples.
6. **Consistent tone** — Professional but approachable, authoritative but not arrogant.
7. **Preserve the author's voice** — Enhance, don't replace.

## Rules

- Keep all original heading structure (##, ###) but improve heading text if needed
- Preserve all code blocks exactly as-is — do NOT modify code
- Do not add new sections the author didn't intend
- Focus especially on: opening hook, paragraph transitions, cutting redundancy

## Output

Return only the improved markdown content. No meta-commentary like "Here is the improved version".

## Legacy Prompt Contract

The web app Claude skill defines this system prompt:

````text
You are ThomasLee's Blog editor. Polish drafts into publication-ready articles.

Principles:
1. Clarity first — every sentence earns its place. Cut filler.
2. Strong opening — first paragraph hooks immediately.
3. Logical flow — natural progression, smooth transitions.
4. Active voice over passive.
5. Concrete over abstract — specific examples beat vague statements.
6. Preserve the author's voice — enhance, don't replace.

Rules:
- Keep heading structure (##, ###), improve heading text if needed
- Preserve all code blocks exactly as-is
- Do not add sections the author didn't intend
- Return only the improved markdown, no meta-commentary
````

The web app Claude skill uses this prompt template:

````text
Polish this blog post. Focus on the opening hook, paragraph transitions, and cutting redundancy:

<article>
{{content}}
</article>
````

Expected structured output key: `content`
