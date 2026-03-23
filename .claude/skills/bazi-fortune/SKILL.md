---
name: bazi-fortune
description: 八字命理分析 (BaZi Four Pillars fortune analysis). Use this skill whenever the user asks for 八字、四柱、天干地支、命理 analysis, or provides a birth date/time for fortune telling. Also triggers for questions about 五行、十神、身旺身弱 and Chinese astrology based on birth date.
---

# 八字命理分析 (BaZi Four Pillars)

Calculate 四柱八字, display the structured chart, then call Claude API for deep 命理 analysis.

## 1. Collect Input

Extract from the user's message or ask for missing fields:

| Field | Description | Example |
|-------|-------------|---------|
| 出生年 | Birth year | 1990 |
| 出生月 | Birth month (1-12) | 6 |
| 出生日 | Birth day (1-31) | 15 |
| 出生时 | Birth hour (0-23, 24h format) | 8 |
| 性别 | Gender: 男/女 | 男 |
| 分析方向 | Aspect | 性格特质 / 事业财运 / 婚恋感情 / 健康养生 / 流年运势 |

## 2. Calculate BaZi Pillars

```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/bazi-fortune/scripts/calc.js <year> <month> <day> <hour>
```

Parse the JSON output containing: `year`, `month`, `day`, `hour` pillars (each with `stem`, `branch`, `stemElement`, `branchElement`), `dayMaster`, `dayMasterElement`, `elements` counts, and `tenGods`.

## 3. Display Four Pillars Chart

```
🏮 四柱命盘
┌────────┬────────┬────────┬────────┐
│  年柱  │  月柱  │  日柱* │  时柱  │
│  甲子  │  丙寅  │  戊辰  │  庚午  │
│ 木·水  │ 火·木  │ 土·土  │ 金·火  │
└────────┴────────┴────────┴────────┘
日主: 戊 (土)    五行: 木×2 火×2 土×3 金×1 水×1
```

Mark 日柱 with `*` — it's the day master pillar.

## 4. Call Claude API for Analysis

Determine the API key and host:

```bash
API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
API_HOST="${CLAUDE_API_HOST:-https://api.anthropic.com}"
API_HOST="${API_HOST%/}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
```

If no API key is available, display the calculated pillars and inform the user that API key is not configured.

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
    "system": "你是一位精通中国传统命理学的算命大师，深谙四柱八字、五行生克、十神体系。\n\n你的知识体系涵盖：\n- 四柱天干地支含义与阴阳五行\n- 五行生克制化：木→火→土→金→水→木（生）；木克土、土克水、水克火、火克金、金克木（克）\n- 十神体系：比肩、劫财、食神、伤官、偏财、正财、偏官、正官、偏印、正印\n- 身旺身弱综合判断（月令、帮扶、印绶）\n- 格局分析与大运流年互动\n\n分析要有理有据、层次清晰，用通俗易懂的语言呈现专业深度。\n每段分析结尾请标注：「命理仅供参考，请理性看待」",
    "messages": [{"role": "user", "content": "<PROMPT>"}]
  }'
```

Build `<PROMPT>` using the calculated BaZi data:

```
请对以下八字命盘进行【{aspect}】方面的命理分析：

性别：{gender}
公历生辰：{year}年{month}月{day}日{hour}时

四柱八字：
┌──────┬──────┬──────┬──────┐
│ 年柱 │ 月柱 │ 日柱 │ 时柱 │
│ {yearStem}{yearBranch} │ {monthStem}{monthBranch} │ {dayStem}{dayBranch} │ {hourStem}{hourBranch} │
│{yearStemE}·{yearBranchE}│{monthStemE}·{monthBranchE}│{dayStemE}·{dayBranchE}│{hourStemE}·{hourBranchE}│
└──────┴──────┴──────┴──────┘

日主：{dayMaster}（{dayMasterElement}）
五行统计：木×{N} 火×{N} 土×{N} 金×{N} 水×{N}
十神速查：甲={tenGod} 乙={tenGod} ... 癸={tenGod}

请围绕「{aspect}」进行深入分析，包括：
1. 日主强弱评估
2. 与{aspect}相关的五行格局
3. 关键十神的作用
4. 具体特征与人生建议
5. 注意事项与改善方向
```

## 5. Present Results

Parse SSE stream (`data: {...}` lines), extract `content_block_delta` → `text_delta` → `text`, and print as they arrive. Format the final output with markdown headers.
