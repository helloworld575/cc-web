---
name: agent-router
description: >-
  Router for agent-facing capabilities. Use whenever the task involves browser
  automation, skill discovery or authoring, long-term memory systems, terminal
  control, or web-app testing, especially before picking a concrete leaf skill.
invocable: false
hierarchy:
  domain: agent
  category: router
  subcategory: routing
  path:
    - agent
    - router
    - routing
  order: 5
lookup:
  invoke: agent/router
  aliases:
    - agent-router
    - agent routing
    - automation router
  keywords:
    - agent
    - automation
    - browser
    - testing
    - skills
    - memory
orchestration:
  role: router
  mode: route
  children:
    - skill: agent-browser
      when: Use for websites, browser automation, login flows, screenshots, web QA, or scripted UI interaction.
      mode: direct
    - skill: webapp-testing
      when: Use for local app validation, Playwright-style checks, regression hunting, or frontend behavior verification.
      mode: direct
    - skill: skill-creator
      when: Use for creating, improving, or evaluating a skill, including trigger tuning and skill benchmark loops.
      mode: direct
    - skill: find-skills
      when: Use when the user asks to find, install, compare, or browse available skills.
      mode: direct
    - skill: memory-systems
      when: Use for long-term memory, persistence layers, knowledge graphs, or agent memory architecture decisions.
      mode: direct
    - skill: tmux
      when: Use for remote control of interactive terminal sessions through tmux panes.
      mode: direct
---
# Agent Router

Choose the smallest agent capability that fully covers the request.

## Routing rules

- Pick `agent-browser` for browser-native interaction or exploratory UI work.
- Pick `webapp-testing` for structured local web-app verification.
- Pick `skill-creator` when the task is about authoring or tuning a skill itself.
- Pick `find-skills` when the user wants to discover or install more skills.
- Pick `memory-systems` for cross-session memory or persistence design.
- Pick `tmux` for interactive terminal control that must happen through tmux.

If more than one child applies, start with the one on the critical path and avoid loading side branches until needed.
