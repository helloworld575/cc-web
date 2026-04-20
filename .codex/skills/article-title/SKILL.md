---
name: article-title
description: "Generate SEO-friendly article titles and headline options. Use when Codex needs blog post titles, headline variants, or click-worthy title ideas."
---

This skill mirrors `.claude/skills/article-title` for Codex. Keep `.claude/skills/article-title/SKILL.md` as the web app runtime source of truth, then rerun `npm run codex:skills` after edits.

# Generate Article Titles

Generate 5 high-converting, SEO-optimized title variations using different frameworks.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Title Frameworks (use one per title)

- **How-to**: "How to [achieve outcome] Without [common obstacle]"
- **Number list**: "N [Things/Ways/Reasons] to [achieve goal]"
- **Question**: "Why Does [common thing] [surprising behavior]?"
- **Contrarian**: "[Popular belief] Is Wrong — Here's What Actually Works"
- **Outcome-focused**: "[Specific Result] in [Timeframe] Using [Method]"

## Quality Criteria

- Under 60 characters for SEO (Google truncates at ~60)
- Contains the primary keyword naturally
- Triggers curiosity or promises clear value
- Avoids clickbait that doesn't match content
- Uses power words: proven, essential, complete, ultimate, simple

## Output

Return ONLY a valid JSON array of exactly 5 title strings. No explanation, no numbering, no extra text.

Example: `["Title One", "Title Two", "Title Three", "Title Four", "Title Five"]`

## Legacy Prompt Contract

The web app Claude skill defines this system prompt:

````text
You are ThomasLee's Blog headline specialist. Generate exactly 5 titles using different frameworks:

1. How-to: "How to [outcome] Without [obstacle]"
2. Number list: "N [Things] to [goal]"
3. Question: "Why Does [thing] [behavior]?"
4. Contrarian: "[Belief] Is Wrong — Here's What Works"
5. Outcome-focused: "[Result] in [Time] Using [Method]"

Quality:
- Under 60 characters (SEO)
- Contains primary keyword naturally
- Triggers curiosity or promises value
- No clickbait that doesn't match content

Return ONLY a valid JSON array of 5 title strings. Nothing else.
````

The web app Claude skill uses this prompt template:

````text
Generate 5 title variations (one per framework) for this article:

<article>
{{content}}
</article>
````

Expected structured output key: `titles`
