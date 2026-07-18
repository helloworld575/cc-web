---
name: subscription
description: >-
  Route subscribed content to the dedicated AI or security subscription
  generation skill according to the configured source topic.
invocable: false
hierarchy:
  domain: knowledge
  category: research
  subcategory: subscriptions
  path:
    - knowledge
    - research
    - subscriptions
  order: 20
lookup:
  invoke: knowledge/research/subscriptions
  aliases:
    - subscription
    - subscription router
    - 订阅生成路由
  keywords:
    - subscription
    - digest
    - ai
    - security
    - 订阅
orchestration:
  role: router
  mode: route
  children:
    - skill: subscription-ai
      when: Use when the subscription source topic is ai.
      mode: direct
    - skill: subscription-security
      when: Use when the subscription source topic is security.
      mode: direct
---
# 订阅生成路由

本 Skill 只负责按订阅源的 `topic` 路由，不直接生成摘要：

- `ai` → `subscription-ai`
- `security` → `subscription-security`

抓取器脚本继续保留在本目录；生成摘要时必须使用对应叶子 Skill，不能回退到通用模板。共同的事实、来源与链接规则见 [references/output-format.md](references/output-format.md)。
