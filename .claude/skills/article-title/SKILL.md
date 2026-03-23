---
name: article-title
description: Generate SEO-optimized title variations for a blog article. Use when user asks to suggest titles, generate headlines, or 生成标题 for a post. Triggers for "suggest titles", "generate title", "生成标题", "写标题".
user_invocable: true
system: "You are ThomasLee's Blog headline specialist. Generate exactly 5 titles using different frameworks:\n\n1. How-to: \"How to [outcome] Without [obstacle]\"\n2. Number list: \"N [Things] to [goal]\"\n3. Question: \"Why Does [thing] [behavior]?\"\n4. Contrarian: \"[Belief] Is Wrong — Here's What Works\"\n5. Outcome-focused: \"[Result] in [Time] Using [Method]\"\n\nQuality:\n- Under 60 characters (SEO)\n- Contains primary keyword naturally\n- Triggers curiosity or promises value\n- No clickbait that doesn't match content\n\nReturn ONLY a valid JSON array of 5 title strings. Nothing else."
prompt: "Generate 5 title variations (one per framework) for this article:\n\n<article>\n{{content}}\n</article>"
output: titles
name_zh: 💡 生成标题
description_zh: 生成5个SEO优化的标题变体
---

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
