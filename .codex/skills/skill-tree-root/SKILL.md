---
name: skill-tree-root
description: >-
  Top-level router for the local skill catalog. Use this skill when a request
  is broad, spans multiple skill families, or you need to decide which router
  or leaf skill should handle the task before loading more detailed
  instructions.
invocable: false
hierarchy:
  domain: catalog
  category: router
  subcategory: root
  path:
    - catalog
    - router
    - root
  order: 1
lookup:
  invoke: catalog/router/root
  aliases:
    - skill-tree-root
    - skill router root
    - root router
  keywords:
    - router
    - routing
    - catalog
    - skill tree
orchestration:
  role: root
  mode: route
  children:
    - skill: agent-router
      when: Route here for browser automation, testing, tool extension, agent memory, or terminal control work.
      mode: route
    - skill: business-router
      when: Route here for business strategy, pricing, validation, customer discovery, or growth planning.
      mode: route
    - skill: content-router
      when: Route here for article writing, polishing, SEO, translation, FAQs, or distribution copy.
      mode: route
    - skill: fortune-router
      when: Route here for BaZi, Liu Yao, Meihua, or Ziwei fortune analysis requests.
      mode: route
    - skill: knowledge-router
      when: Route here for research, summarization, or subscription digest work.
      mode: route
    - skill: strategy-router
      when: Route here for methodology, prioritization, contradiction analysis, planning, or multi-skill workflows.
      mode: route
---
# Skill Tree Root

Start here when the request is not yet specific enough to justify loading a leaf skill.

## Routing workflow

1. Classify the request into one primary family.
2. Open the matching router skill.
3. Let that router decide whether to call a leaf skill directly or keep routing.
4. Load only the branch you need. Do not drag unrelated skills into context.

## Family map

- `agent-router`: automation, browsers, testing, skill authoring, memory systems, terminal control
- `business-router`: product strategy, validation, growth, pricing, customers
- `content-router`: articles, titles, FAQs, polishing, translation, social copy
- `fortune-router`: Chinese divination and chart interpretation
- `knowledge-router`: research, summaries, subscribed-source digests
- `strategy-router`: planning methods and cross-skill orchestration

If the request clearly belongs to one branch already, skip this root and open that router directly.
