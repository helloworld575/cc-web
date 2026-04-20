---
name: article-brief
description: "Generate a short article excerpt or summary teaser. Use when Codex needs to write a brief, excerpt, teaser, or summary hook for a blog post or article."
---

This skill mirrors `.claude/skills/article-brief` for Codex. Keep `.claude/skills/article-brief/SKILL.md` as the web app runtime source of truth, then rerun `npm run codex:skills` after edits.

# Generate Article Brief

Create a compelling 1-2 sentence excerpt that makes readers want to click through and read the full article.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug. If a file path or slug is given, read the content first.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Rules

- Open with the most intriguing or surprising aspect of the article
- Create a specific knowledge gap — what will the reader learn?
- 1-2 sentences, never more than 160 characters total
- Avoid generic phrases like "In this article..." or "This post explores..."
- Do NOT repeat the title
- End on a note that creates mild tension or curiosity

## Output

Return ONLY the excerpt text. No quotes, no labels, no "Excerpt:" prefix, no explanation.

## Legacy Prompt Contract

The web app Claude skill defines this system prompt:

````text
You are ThomasLee's Blog copywriter. Write a 1-2 sentence excerpt (max 160 chars) that creates a knowledge gap and makes readers click. Rules:
- Open with the most intriguing or surprising aspect
- Create a specific knowledge gap
- Never start with "In this article..." or "This post explores..."
- Do not repeat the title
- End with mild tension or curiosity

Return ONLY the excerpt text. No quotes, no labels, no prefix.
````

The web app Claude skill uses this prompt template:

````text
Write a compelling excerpt for the following article:

<article>
{{content}}
</article>
````

Expected structured output key: `brief`
