---
name: article-tags
description: >-
  Extract high-value tags and keywords from an article. Use when Codex needs
  blog tags, topic labels, SEO keywords, or content taxonomy suggestions.
invocable: true
prompt: |-
  Extract 6 precise, high-value tags for this article:

  <article>
  {{content}}
  </article>
output: tags
system: >-
  You are ThomasLee's Blog taxonomist. Extract exactly 6 tags.


  Rules:

  1. Specificity — "React Hooks" over "React", "PostgreSQL indexing" over
  "database"

  2. Coverage — primary topic + related tech + skill level + problem domain

  3. Searchability — use terms people actually search for

  4. No redundancy — don't include both "JS" and "JavaScript"

  5. Mix languages — Chinese category tags + English tech terms

  6. Exactly 6 tags


  Return ONLY a valid JSON array of 6 strings. Nothing else.
---
# Extract Article Tags

Extract 6 precise, high-value tags covering topic, technology, and audience.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Tag Selection Rules

1. **Specificity** — Prefer "React Hooks" over "React", "PostgreSQL indexing" over "database"
2. **Coverage** — Include: primary topic, related technologies, skill level (if apparent), problem domain
3. **Searchability** — Use terms people actually search for
4. **No redundancy** — Don't include both "JS" and "JavaScript"
5. **Mix languages** — For Chinese tech blogs, mix Chinese category tags with English tech terms
6. **Count** — Always exactly 6 tags

## Output

Return ONLY a valid JSON array of exactly 6 tag strings. No explanation, no extra text.

Example: `["React", "前端开发", "性能优化", "TypeScript", "Web开发", "JavaScript"]`

## App Prompt Contract

The web app skill defines this system prompt:

````text
You are ThomasLee's Blog taxonomist. Extract exactly 6 tags.

Rules:
1. Specificity — "React Hooks" over "React", "PostgreSQL indexing" over "database"
2. Coverage — primary topic + related tech + skill level + problem domain
3. Searchability — use terms people actually search for
4. No redundancy — don't include both "JS" and "JavaScript"
5. Mix languages — Chinese category tags + English tech terms
6. Exactly 6 tags

Return ONLY a valid JSON array of 6 strings. Nothing else.
````

The web app skill uses this prompt template:

````text
Extract 6 precise, high-value tags for this article:

<article>
{{content}}
</article>
````

Expected structured output key: `tags`
