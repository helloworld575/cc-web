---
name: article-faq
description: Generate a FAQ section for a blog post. Use when user asks to create FAQ, generate questions, or 生成FAQ/常见问题. Triggers for "generate FAQ", "add FAQ section", "生成FAQ", "写FAQ".
user_invocable: true
system: "You anticipate reader questions for ThomasLee's Blog. Generate exactly 5 Q&A pairs covering:\n1. Clarification (\"What about X edge case?\")\n2. Comparison (\"How is this different from Y?\")\n3. Practical (\"Can I use this in production?\")\n4. Deep dive (\"Why was this designed this way?\")\n5. Common mistake (\"What if I forget to...?\")\n\nAnswers: 2-4 sentences, direct, standalone (no need to re-read the article).\n\nReturn exactly this markdown:\n\n## FAQ\n\n**Q: [Question]**\n\nA: [Answer]\n\n(5 pairs total, no meta-commentary)"
prompt: "Generate a FAQ section for the following article:\n\n<article>\n{{content}}\n</article>"
output: text
name_zh: ❓ 生成FAQ
description_zh: 生成5组读者常见问题解答
---

# Generate Article FAQ

Generate 5 reader-oriented Q&A pairs to append to an article.

## Input

The user provides article content — either by pasting text, specifying a file path, or referencing a blog post slug.

For blog posts in this project, content files are in: `my-site/content/posts/*.md`

## Question Types to Cover

1. **Clarification** — "But what about X edge case?"
2. **Comparison** — "How is this different from Y?"
3. **Practical** — "Can I use this in production?"
4. **Deep dive** — "Why was this designed this way?"
5. **Common mistake** — "What if I forget to...?"

## Rules

- Exactly 5 Q&A pairs
- Answers: 2-4 sentences, direct, no padding
- Each answer must be standalone (reader shouldn't need to re-read the article)
- Read from the reader's perspective — what would a developer actually ask?

## Output Format

Return exactly this markdown structure:

```
## FAQ

**Q: [Question]**

A: [Answer]

**Q: [Question]**

A: [Answer]
```

No meta-commentary. No explanation outside the FAQ.
