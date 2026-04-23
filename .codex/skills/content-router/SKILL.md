---
name: content-router
description: >-
  Router for writing and publishing workflows. Use this whenever the task is
  about article structure, polishing, FAQ generation, titles, tags,
  translation, or turning content into social posts before picking a leaf
  content skill.
invocable: false
hierarchy:
  domain: content
  category: router
  subcategory: routing
  path:
    - content
    - router
    - routing
  order: 5
lookup:
  invoke: content/router
  aliases:
    - content-router
    - content routing
    - article router
  keywords:
    - content
    - article
    - blog
    - faq
    - title
    - tags
    - translate
orchestration:
  role: router
  mode: route
  children:
    - skill: article-faq
      when: Use when the user needs a FAQ section, common reader questions, or a Q&A block for an article.
      mode: direct
    - skill: article-title
      when: Use when the user needs headline options, title exploration, or SEO-friendly article titles.
      mode: direct
    - skill: article-brief
      when: Use when the user needs an excerpt, teaser, or short summary hook for a post.
      mode: direct
    - skill: article-structure
      when: Use when the article needs section reordering, better flow, or stronger narrative structure.
      mode: direct
    - skill: article-polish
      when: Use when wording, clarity, rhythm, or readability needs improvement without changing core meaning.
      mode: direct
    - skill: article-tags
      when: Use when the user needs tags, topical keywords, or content taxonomy labels.
      mode: direct
    - skill: article-translate-en
      when: Use when Chinese article content should be translated into natural English.
      mode: direct
    - skill: blog-to-x
      when: Use when a blog post or diary entry should be converted into X or Twitter posts.
      mode: direct
---
# Content Router

Route to the most specific content leaf skill instead of doing several writing transforms in one step.

## Routing rules

- Reader support blocks: `article-faq`
- Headline and packaging: `article-title`, `article-brief`, `article-tags`
- Editorial improvements: `article-structure`, `article-polish`
- Language change: `article-translate-en`
- Distribution copy: `blog-to-x`

If the user asks for multiple content outputs, execute them sequentially and keep the intermediate article state explicit.
