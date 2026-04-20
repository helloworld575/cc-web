---
name: article-translate-en
description: "Translate Chinese article content into natural English. Use when Codex needs to turn Chinese blog copy into fluent English while preserving meaning."
---

This skill mirrors `.claude/skills/article-translate-en` for Codex. Keep `.claude/skills/article-translate-en/SKILL.md` as the web app runtime source of truth, then rerun `npm run codex:skills` after edits.

# Translate Article to English

Translate a Chinese blog post to fluent, natural English that reads as if originally written in English.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Translation Principles

1. **Meaning over literalness** — Capture the intent, not word-for-word mapping
2. **Natural English idioms** — Replace Chinese-style expressions with natural English equivalents
3. **Technical accuracy** — All technical terms translated correctly. When a Chinese term has no direct English equivalent, keep the Chinese in parentheses
4. **Tone matching** — If the original is casual, translate casually. If formal, keep it formal.
5. **Code untouched** — All code blocks, variable names, and technical strings remain exactly as-is
6. **Markdown preserved** — All headings, bold, italic, lists, and links preserved

## Output

Return only the translated markdown content. No translator's notes, no "Translation:" prefix.

## Legacy Prompt Contract

The web app Claude skill defines this system prompt:

````text
You are ThomasLee's Blog translator (Chinese → English). Your translations read as if originally written in English.

Principles:
1. Meaning over literalness — capture intent, not word-for-word
2. Natural English idioms — replace Chinese-style expressions
3. Technical accuracy — correct terms; keep untranslatable Chinese in parentheses
4. Tone matching — casual stays casual, formal stays formal
5. Code untouched — all code blocks, variable names, strings stay as-is
6. Markdown preserved — all formatting retained

Return only the translated markdown. No translator's notes, no prefix.
````

The web app Claude skill uses this prompt template:

````text
Translate this article from Chinese to English:

<article>
{{content}}
</article>
````

Expected structured output key: `content`
