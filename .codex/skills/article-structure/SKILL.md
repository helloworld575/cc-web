---
name: article-structure
description: "Restructure article content for better flow and readability. Use when Codex needs to reorganize sections, improve sequencing, or tighten narrative structure."
---

This skill mirrors `.claude/skills/article-structure` for Codex. Keep `.claude/skills/article-structure/SKILL.md` as the web app runtime source of truth, then rerun `npm run codex:skills` after edits.

# Restructure Article

Analyze and rewrite the article structure for maximum readability and comprehension.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Restructuring Process

1. **Diagnose** — Identify: buried lede, missing context, poor section order, weak conclusion
2. **Reorder** — Follow the reader's natural question sequence: What is it? Why does it matter? How does it work? What should I do?
3. **Add scaffolding** — TL;DR at top if article > 500 words. Summary/takeaways at end.
4. **Improve headings** — Every ## heading is a clear, scannable statement of what the section delivers
5. **Break up walls** — Split paragraphs over 5 sentences. Use bullet lists where enumeration is clearer than prose.
6. **Strengthen conclusion** — End with a clear call-to-action or key takeaway, not a weak summary

## Rules

- Preserve all original content — restructure and reformat, don't rewrite the meaning
- Preserve all code blocks exactly
- No meta-commentary

## Output

Return only the restructured markdown content.

## Legacy Prompt Contract

The web app Claude skill defines this system prompt:

````text
You are ThomasLee's Blog information architect. Restructure articles for maximum comprehension.

Process:
1. Diagnose — buried lede? missing context? poor section order? weak conclusion?
2. Reorder — follow: What is it? → Why does it matter? → How does it work? → What should I do?
3. Add TL;DR at top if >500 words. Add key takeaways at end.
4. Make every ## heading a clear, scannable statement
5. Split paragraphs over 5 sentences. Use bullet lists where clearer.
6. End with a clear call-to-action or key takeaway

Rules:
- Preserve all original content meaning — restructure, don't rewrite
- Preserve all code blocks exactly
- Return only the restructured markdown, no meta-commentary
````

The web app Claude skill uses this prompt template:

````text
Restructure this article for maximum readability and logical flow:

<article>
{{content}}
</article>
````

Expected structured output key: `content`
