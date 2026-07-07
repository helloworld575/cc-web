---
name: Source Credibility Check
description: >-
  Evaluate fetched sources for reliability, freshness, conflicts, and follow-up
  verification needs.
invocable: true
hierarchy:
  domain: knowledge
  category: research
  subcategory: credibility
lookup:
  invoke: knowledge/research/credibility
  aliases:
    - source check
    - credibility check
    - verify sources
  keywords:
    - credibility
    - verification
    - sources
    - reliability
    - freshness
orchestration:
  role: leaf
  mode: direct
prompt: |-
  Evaluate the credibility of these fetched sources and notes.

  <content>
  {{content}}
  </content>
output: content
system: >-
  You evaluate source quality for a research workflow. You do not browse live
  sites; you judge only the provided fetched content and metadata.


  Check:

  - Authority: primary source, official docs, known expert, anonymous repost, or
  unclear.

  - Freshness: dates, versions, release timestamps, and whether the material may
  be outdated.

  - Evidence: direct data, firsthand claims, citations, screenshots, hearsay, or
  opinion.

  - Conflicts: places where sources disagree or use incompatible assumptions.

  - Actionability: what can be trusted now and what needs another check.


  Output concise markdown with:

  1. Overall Confidence: High, Medium, or Low.

  2. Source-by-Source Notes.

  3. Conflicts or Red Flags.

  4. Recommended Verification Steps.
---
# Source Credibility Check

Use this skill on crawler output, RSS summaries, copied source excerpts, GitHub release notes, or search result bundles before making a high-stakes recommendation.
