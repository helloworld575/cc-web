---
name: ziwei-fortune
description: 紫微斗数命理分析 (Zi Wei Dou Shu purple star astrology). Use this skill whenever the user asks for 紫微斗数、紫微、命宫、身宫、十二宫、大限 analysis, or wants a Zi Wei Dou Shu chart reading from birth date. Triggers for Chinese astrology requests mentioning 五行局、纳音、紫微星 or palace-based fortune analysis.
---

# 紫微斗数分析 (Zi Wei Dou Shu)

Calculate a 紫微斗数 chart (命宫, 身宫, 五行局, 十二宫), then call Claude API for deep analysis.

## 1. Collect Input

Extract from the user's message or ask for missing fields:

| Field | Description | Example |
|-------|-------------|---------|
| 出生年 | Birth year | 1990 |
| 出生月 | Birth month (1-12) | 6 |
| 出生日 | Birth day (1-31) | 15 |
| 出生时 | Birth hour (0-23, 24h format) | 8 |
| 性别 | Gender: 男/女 | 男 |
| 分析方向 | Aspect | 性格命格 / 事业官禄 / 婚姻夫妻 / 财帛运势 / 大限流年 |

## 2. Calculate Zi Wei Chart

```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/ziwei-fortune/scripts/calc.js <year> <month> <day> <hour>
```

Parse the JSON output containing: `yearStem`, `yearBranch`, `mingGongBranch`, `shenGongBranch`, `nayinName`, `nayinElement`, `wuxingJu` (name + num), and `palaces` (12 entries with name + branch).

## 3. Display the Chart

```
⭐ 紫微斗数命盘
年柱: {yearStem}{yearBranch} (纳音: {nayinName})
命宫: {mingGongBranch}宫  |  身宫: {shenGongBranch}宫
五行局: {wuxingJu.name}

十二宫排布:
命宫({branch}) 兄弟({branch}) 夫妻({branch}) 子女({branch})
财帛({branch}) 疾厄({branch}) 迁移({branch}) 仆役({branch})
官禄({branch}) 田宅({branch}) 福德({branch}) 父母({branch})
```

## 4. Call Claude API for Analysis

Determine the API key and host:

```bash
API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
API_HOST="${CLAUDE_API_HOST:-https://api.anthropic.com}"
API_HOST="${API_HOST%/}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
```

If no API key is available, display the calculated chart and inform the user that API key is not configured.

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
    "system": "你是一位精通紫微斗数的命理大师，深谙十四主星、十二宫位、四化飞星、大限流年体系。\n\n你的知识涵盖：\n- 命宫身宫的核心意义与相互关系\n- 五行局（水二局、木三局、金四局、土五局、火六局）对命主运程的影响\n- 十二宫位的含义与宫干飞化\n- 大限流年运势推演\n\n分析要结合命宫身宫五行局，层次清晰，通俗易懂。\n每段结尾标注：「命理仅供参考，请理性看待」",
    "messages": [{"role": "user", "content": "<PROMPT>"}]
  }'
```

Build `<PROMPT>`:

```
请对以下紫微斗数命盘进行【{aspect}】方面的命理分析：

性别：{gender}
公历生辰：{year}年{month}月{day}日{hour}时

基本信息：
- 年柱：{yearStem}{yearBranch}
- 命宫：{mingGongBranch}宫
- 身宫：{shenGongBranch}宫
- 纳音五行：{nayinName}（{wuxingJu.name}）

十二宫排布：
{palaces formatted as: palaceName(branch) for all 12}

请围绕「{aspect}」进行深入分析，包括：
1. 命宫（{mingGongBranch}）的基本格局与性情
2. 身宫（{shenGongBranch}）的修身与后天发展
3. {wuxingJu.name}对命主的影响
4. 与{aspect}相关的关键宫位分析
5. 具体建议与人生指导
```

## 5. Present Results

Parse SSE stream (`data: {...}` lines), extract `content_block_delta` → `text_delta` → `text`, and print as they arrive. Format with markdown headers.

## Notes

- 命宫 is the primary palace (生命中心) — always lead analysis with it
- 身宫 governs physical body and later-life development
- 五行局 determines the starting age of major life cycles (大限)
