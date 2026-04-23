---
name: strategy-router
description: >-
  Router for methodology and planning skills. Use when the work is blocked by
  unclear priorities, contradictions, feedback loops, long-horizon strategy, or
  when several skills must be chained in a deliberate workflow.
invocable: false
hierarchy:
  domain: strategy
  category: router
  subcategory: routing
  path:
    - strategy
    - router
    - routing
  order: 5
lookup:
  invoke: strategy/router
  aliases:
    - strategy-router
    - planning router
    - methodology router
  keywords:
    - strategy
    - planning
    - workflow
    - prioritize
    - contradiction
    - iteration
orchestration:
  role: router
  mode: route
  children:
    - skill: arming-thought
      when: Use at the start of a broad top-level task to anchor the work in facts and choose downstream skills deliberately.
      mode: direct
    - skill: contradiction-analysis
      when: Use when the problem has competing forces, unclear priorities, or no obvious first move.
      mode: direct
    - skill: investigation-first
      when: Use when facts are incomplete and judgment should wait for more first-hand evidence.
      mode: direct
    - skill: concentrate-forces
      when: Use when effort is being split across too many parallel goals and one main breakthrough must be chosen.
      mode: direct
    - skill: overall-planning
      when: Use when several important goals must be balanced together and optimizing one can damage another.
      mode: direct
    - skill: practice-cognition
      when: Use when a hypothesis needs to be tested in practice and improved through iteration.
      mode: direct
    - skill: mass-line
      when: Use when many inputs must be collected, synthesized, and validated with affected users or executors.
      mode: direct
    - skill: criticism-self-criticism
      when: Use after delivery or at a review point to examine failures honestly and correct them.
      mode: direct
    - skill: protracted-strategy
      when: Use when the work is long-horizon, difficult, and cannot be won quickly.
      mode: direct
    - skill: spark-prairie-fire
      when: Use when starting from nearly nothing and needing a small durable foothold before scaling up.
      mode: direct
    - skill: workflows
      when: Use when the task clearly needs several skills chained together in a standard sequence.
      mode: route
---
# Strategy Router

Choose the thinking tool that removes the current bottleneck.

## Routing rules

- Missing facts: `investigation-first`
- Conflicting priorities: `contradiction-analysis`, `concentrate-forces`
- System-level tradeoffs: `overall-planning`
- Iteration and validation: `practice-cognition`
- Collective input and feedback: `mass-line`, `criticism-self-criticism`
- Long-term or bootstrap execution: `protracted-strategy`, `spark-prairie-fire`
- Multi-skill sequence design: `workflows`

Do not load every planning skill at once. Pick the present contradiction, solve it, then reassess.
