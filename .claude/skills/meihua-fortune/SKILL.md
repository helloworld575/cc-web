---
name: meihua-fortune
description: 梅花易数占卜分析 (Mei Hua Yi Shu plum blossom numerology divination). Use this skill whenever the user asks for 梅花易数、体卦、用卦、梅花 readings, wants to use numbers or time to generate a hexagram, or asks about 邵康节 divination method. Also triggers when users want a quick I Ching reading using numbers (like spotting a number and asking what it means).
---

# 梅花易数占卜 (Plum Blossom Numerology)

Generate a 梅花易数 hexagram using random, time, or number input — identify 体卦 (subject) and 用卦 (object) — then call Claude API for 五行生克 analysis.

## 1. Collect Input

Extract from the user's message or ask for missing fields:

| Field | Description | Example |
|-------|-------------|---------|
| 起卦方式 | Method: `random` / `time` / `number` | number |
| 所问之事 | Question (optional) | 此次考试能否通过？ |
| 年/月/日/时 | Only for `time` method | 2026 3 23 14 |
| 上卦数/下卦数 | Only for `number` method | 7 3 |

Default to `random` if no method specified. Numbers can come from anything (门牌号、时间、随机念到的数字).

## 2. Generate Hexagram

**Random:**
```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js random
```

**Time:**
```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js time <year> <month> <day> <hour>
```

**Number:**
```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js number <n1> <n2>
```

Parse the JSON output containing: `lines`, `lower`/`upper` (trigram indices), `lowerTrigram`/`upperTrigram` (name/element/nature), `hex` (name/full), `changing` (changing line indices), `transformed`.

## 3. Display Hexagram

In 梅花易数: lower trigram = 体卦 (subject/self), upper trigram = 用卦 (object/situation).

```
🌸 梅花易数卦象

本卦: {hex.fullName}
体卦（下/主）: {lower.name}（{lower.nature}）{lower.element}
用卦（上/客）: {upper.name}（{upper.nature}）{upper.element}

五行关系: 体卦 {lower.element} vs 用卦 {upper.element} → {relationship}

动爻: 第N爻（从下数）
变卦: {transformed.fullName}
```

五行体用关系速记:
- 体生用 → 我付出，主动，耗力
- 用生体 → 得贵人相助，有助力（最吉）
- 体克用 → 我主导，事成但需努力
- 用克体 → 受阻碍，不利（最凶）
- 体用同 → 平稳，无大起落

## 4. Call Claude API for Analysis

Determine the API key and host:

```bash
API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
API_HOST="${CLAUDE_API_HOST:-https://api.anthropic.com}"
API_HOST="${API_HOST%/}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
```

If no API key is available, display the hexagram and inform the user that API key is not configured.

Make the streaming request:

```bash
curl -s -N "${API_HOST}/v1/messages" \
  -H "x-api-key: ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "'${MODEL}'",
    "max_tokens": 2048,
    "stream": true,
    "system": "你是一位精通梅花易数的占卜大师，深谙邵康节体用之法。\n\n你的知识涵盖：\n- 体卦（下卦/主）为自己/主体，用卦（上卦/客）为事物/对方\n- 五行生克断吉凶：用生体最吉，用克体最凶\n- 动爻为事物变化的枢纽\n- 变卦显示事态演变方向\n\n解卦以体卦为主，分析体用五行生克，结合动爻变卦，判断吉凶走向。\n每段结尾标注：「占卜仅供参考，请理性看待」",
    "messages": [{"role": "user", "content": "<PROMPT>"}]
  }'
```

Build `<PROMPT>`:

```
请对以下梅花易数卦象进行占卜分析：

{question ? "问题：" + question : "（起卦，求总体指引）"}

本卦：{hex.fullName}
体卦（下卦）：{lower.name}（{lower.nature}/{lower.element}）
用卦（上卦）：{upper.name}（{upper.nature}/{upper.element}）
{movingLine !== undefined ? "动爻：第" + (movingLine+1) + "爻（从下数）" : "无动爻"}
{transformed ? "变卦：" + transformed.fullName : ""}

请进行梅花易数解析，包括：
1. 体卦（{lower.name}/{lower.element}）代表主体的状态
2. 用卦（{upper.name}/{upper.element}）代表事物发展方向
3. 体用五行生克关系（{lower.element}与{upper.element}）
4. 动爻变化与事情走向
5. 综合建议与吉凶判断
```

## 5. Present Results

Parse SSE stream and print text deltas as they arrive. Format with markdown headers.

## Notes

- 梅花易数 core principle: 体卦 = 自己, 用卦 = 事物/对方
- 用生体 is most auspicious; 用克体 is most challenging
- The moving line shows the pivot point — where change is happening
