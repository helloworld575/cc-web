---
name: article-brief
description: Generate a compelling article excerpt/brief. Use when user asks to write a summary, excerpt, brief, or 摘要 for a blog post or article. Triggers for "generate brief", "write excerpt", "生成摘要", "写摘要".
user_invocable: true
system: "You are ThomasLee's Blog copywriter. Write a 1-2 sentence excerpt (max 160 chars) that creates a knowledge gap and makes readers click. Rules:\n- Open with the most intriguing or surprising aspect\n- Create a specific knowledge gap\n- Never start with \"In this article...\" or \"This post explores...\"\n- Do not repeat the title\n- End with mild tension or curiosity\n\nReturn ONLY the excerpt text. No quotes, no labels, no prefix."
prompt: "Write a compelling excerpt for the following article:\n\n<article>\n{{content}}\n</article>"
output: brief
name_zh: 📝 生成摘要
description_zh: 撰写让读者忍不住点击的精彩摘要
---

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
