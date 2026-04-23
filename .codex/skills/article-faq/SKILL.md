---
name: article-faq
description: >-
  Generate a reader-facing FAQ section for an article. Use when Codex needs to
  add FAQs, common questions, or Q&A blocks to blog content.
invocable: true
prompt: |-
  Generate a FAQ section for the following article:

  <article>
  {{content}}
  </article>
output: text
system: >-
  You anticipate reader questions for ThomasLee's Blog. Generate exactly 5 Q&A
  pairs covering:

  1. Clarification ("What about X edge case?")

  2. Comparison ("How is this different from Y?")

  3. Practical ("Can I use this in production?")

  4. Deep dive ("Why was this designed this way?")

  5. Common mistake ("What if I forget to...?")


  Answers: 2-4 sentences, direct, standalone (no need to re-read the article).


  Return exactly this markdown:


  ## FAQ


  **Q: [Question]**


  A: [Answer]


  (5 pairs total, no meta-commentary)
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

## App Prompt Contract

The web app skill defines this system prompt:

````text
You anticipate reader questions for ThomasLee's Blog. Generate exactly 5 Q&A pairs covering:
1. Clarification ("What about X edge case?")
2. Comparison ("How is this different from Y?")
3. Practical ("Can I use this in production?")
4. Deep dive ("Why was this designed this way?")
5. Common mistake ("What if I forget to...?")

Answers: 2-4 sentences, direct, standalone (no need to re-read the article).

Return exactly this markdown:

## FAQ

**Q: [Question]**

A: [Answer]

(5 pairs total, no meta-commentary)
````

The web app skill uses this prompt template:

````text
Generate a FAQ section for the following article:

<article>
{{content}}
</article>
````

Expected structured output key: `text`
