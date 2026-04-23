---
name: fortune-router
description: >-
  Router for Chinese divination and astrology skills. Use when the request
  involves birth charts, BaZi, Liu Yao, Meihua Yishu, Zi Wei Dou Shu, or when
  you must decide which fortune-analysis method fits the user's inputs.
invocable: false
hierarchy:
  domain: fortune
  category: router
  subcategory: routing
  path:
    - fortune
    - router
    - routing
  order: 5
lookup:
  invoke: fortune/router
  aliases:
    - fortune-router
    - divination router
    - astrology router
  keywords:
    - fortune
    - bazi
    - liuyao
    - meihua
    - ziwei
orchestration:
  role: router
  mode: route
  children:
    - skill: bazi-fortune
      when: Use when the user provides birth date and time for Four Pillars or BaZi interpretation.
      mode: direct
    - skill: liuyao-fortune
      when: Use when the user asks for Liu Yao or I Ching line-based divination interpretation.
      mode: direct
    - skill: meihua-fortune
      when: Use when the user asks for Meihua Yishu or numerology-style divination.
      mode: direct
    - skill: ziwei-fortune
      when: Use when the user provides palace-based Zi Wei Dou Shu birth details.
      mode: direct
---
# Fortune Router

Select the divination method from the structure of the user's input.

## Routing rules

- Birth date and time with stems and branches: `bazi-fortune`
- Hexagram or line-change interpretation: `liuyao-fortune`
- Meihua-style number or image interpretation: `meihua-fortune`
- Palace chart / Ziwei terminology: `ziwei-fortune`

If the user has not provided enough details for the chosen method, ask only for the missing inputs that the selected leaf skill needs.
