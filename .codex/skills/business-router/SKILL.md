---
name: business-router
description: >-
  Router for business and product strategy skills. Use when the request is about
  company values, market validation, MVP scope, pricing, customers, growth, or
  operational simplification and you need the right business leaf skill.
invocable: false
hierarchy:
  domain: business
  category: router
  subcategory: routing
  path:
    - business
    - router
    - routing
  order: 5
lookup:
  invoke: business/router
  aliases:
    - business-router
    - business routing
    - product strategy router
  keywords:
    - business
    - strategy
    - pricing
    - customers
    - validation
    - growth
orchestration:
  role: router
  mode: route
  children:
    - skill: validate-idea
      when: Use when the user wants to assess whether an idea is worth pursuing before building.
      mode: direct
    - skill: mvp
      when: Use when the user needs to scope a smaller first product or reduce an overbuilt plan.
      mode: direct
    - skill: processize
      when: Use when the user should deliver the value manually first before productizing it.
      mode: direct
    - skill: pricing
      when: Use when the user needs pricing strategy, price changes, or packaging decisions.
      mode: direct
    - skill: first-customers
      when: Use when the user needs a path to early customers or first revenue.
      mode: direct
    - skill: marketing-plan
      when: Use when the user needs audience growth or content-led marketing after some validation exists.
      mode: direct
    - skill: grow-sustainably
      when: Use when the user is evaluating scale, hiring, spending, or growth tradeoffs.
      mode: direct
    - skill: minimalist-review
      when: Use when the user wants a strategy gut-check or decision review.
      mode: direct
    - skill: company-values
      when: Use when the user wants to define principles, culture, or values for a team or company.
      mode: direct
    - skill: find-community
      when: Use when the user is looking for a niche, community, or market to serve.
      mode: direct
---
# Business Router

Pick the leaf skill that matches the current business stage.

## Routing rules

- Discovery stage: `find-community`, `validate-idea`
- First offer stage: `processize`, `mvp`, `pricing`
- Early traction stage: `first-customers`, `marketing-plan`
- Ongoing operating decisions: `grow-sustainably`, `minimalist-review`, `company-values`

When the user mixes several business questions together, handle the immediate bottleneck first instead of loading every business skill.
