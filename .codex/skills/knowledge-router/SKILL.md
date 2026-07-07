---
name: knowledge-router
description: >-
  Router for research and synthesis skills. Use when the user needs deep
  research, a summary from a URL or file, or a digest from subscribed sources,
  and you need the right knowledge-processing leaf skill.
invocable: false
hierarchy:
  domain: knowledge
  category: router
  subcategory: routing
  path:
    - knowledge
    - router
    - routing
  order: 5
lookup:
  invoke: knowledge/router
  aliases:
    - knowledge-router
    - research router
    - summary router
  keywords:
    - knowledge
    - research
    - summarize
    - subscription
    - digest
orchestration:
  role: router
  mode: route
  children:
    - skill: research
      when: >-
        Use when the user asks for deep research, comparisons, market analysis,
        or a citation-grounded report.
      mode: direct
    - skill: summarize
      when: >-
        Use when the user needs a summary, transcript extraction, or concise
        synthesis of a URL, file, or media source.
      mode: direct
    - skill: subscription
      when: >-
        Use when the user wants the latest updates or digests from subscribed
        feeds and tracked sources.
      mode: direct
    - skill: web-research-brief
      when: >-
        Use when fetched web, RSS, search, or crawler output needs a concise
        provider-neutral research brief.
      mode: direct
    - skill: source-credibility-check
      when: >-
        Use when fetched sources need reliability, freshness, conflict, or
        verification review.
      mode: direct
---
# Knowledge Router

Pick the smallest synthesis skill that matches the ask.

## Routing rules

- Broad multi-source investigation: `research`
- Single-source or compact summarization: `summarize`
- Ongoing update digest from followed sources: `subscription`
- Fetched web context that needs a concise brief: `web-research-brief`
- Source reliability and freshness review: `source-credibility-check`

Prefer `research` only when the task truly needs multi-source synthesis with citations; do not overuse it for simple summaries.
