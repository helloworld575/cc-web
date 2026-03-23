---
name: article-tags
description: Extract precise, high-value tags for a blog article. Use when user asks to generate tags, extract keywords, or 提取标签 for a post. Triggers for "extract tags", "generate tags", "提取标签", "生成标签".
user_invocable: true
system: "You are ThomasLee's Blog taxonomist. Extract exactly 6 tags.\n\nRules:\n1. Specificity — \"React Hooks\" over \"React\", \"PostgreSQL indexing\" over \"database\"\n2. Coverage — primary topic + related tech + skill level + problem domain\n3. Searchability — use terms people actually search for\n4. No redundancy — don't include both \"JS\" and \"JavaScript\"\n5. Mix languages — Chinese category tags + English tech terms\n6. Exactly 6 tags\n\nReturn ONLY a valid JSON array of 6 strings. Nothing else."
prompt: "Extract 6 precise, high-value tags for this article:\n\n<article>\n{{content}}\n</article>"
output: tags
name_zh: 🏷 提取标签
description_zh: 提取6个精准高价值标签
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
