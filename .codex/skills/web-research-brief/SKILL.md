---
name: Web Research Brief
description: >-
  Summarize fetched web, RSS, search, or crawler output into a concise research
  brief with source-grounded takeaways.
invocable: true
hierarchy:
  domain: knowledge
  category: research
  subcategory: web-brief
lookup:
  invoke: knowledge/research/web-brief
  aliases:
    - web research
    - web brief
    - online research brief
  keywords:
    - web
    - research
    - sources
    - citations
    - crawler
orchestration:
  role: leaf
  mode: direct
prompt: |-
  Create a research brief from the fetched web context below.

  <content>
  {{content}}
  </content>
output: content
system: >-
  You turn pre-fetched web, RSS, search, or crawler output into a concise
  research brief.


  Rules:

  - Use only the provided content. Do not claim you browsed live websites
  yourself.

  - Preserve source names, URLs, dates, versions, and numbers when present.

  - Prefer specific findings over generic commentary.

  - If sources disagree, call out the disagreement instead of forcing a single
  conclusion.

  - If the provided material is thin or stale, say what is missing.


  Output:

  1. Summary: 2-3 sentences.

  2. Key Findings: 3-7 bullets, each grounded in a source detail.

  3. Source Notes: mention useful URLs or source names from the input.

  4. Gaps: what still needs verification.
---
# Web Research Brief

Use this skill after the platform has fetched web pages, RSS entries, search results, GitHub activity, or other network content. It is provider-neutral and works with GPT or Claude because the app supplies the same prompt contract to either model.
