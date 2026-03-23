---
name: liuyao-fortune
description: 周易六爻占卜分析 (I Ching Liu Yao divination). Use this skill whenever the user asks for 周易、六爻、卦象、占卜 readings, wants to ask the I Ching a question, or mentions 本卦、变卦、动爻 interpretation. Also triggers for general 易经 questions about a specific situation or decision.
---

# 周易六爻占卜 (I Ching Six Lines Divination)

Generate a 六爻 hexagram, display the full hexagram with changing lines, then call Claude API for deep interpretation.

## 1. Collect Input

Extract from the user's message or ask for missing fields:

| Field | Description | Example |
|-------|-------------|---------|
| 起卦方式 | Method: `random` (摇卦) or `time` (时间起卦) | random |
| 所问之事 | Question (optional, improves analysis) | 此次创业能否成功？ |
| 年/月/日/时 | Only needed if method is `time` | 2026 3 23 14 |

Default to `random` if no method specified. If the user just says "帮我起一卦" or "占卜一下", use `random`.

## 2. Generate Hexagram

**Random method:**
```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/liuyao-fortune/scripts/calc.js random
```

**Time method:**
```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/liuyao-fortune/scripts/calc.js time <year> <month> <day> <hour>
```

Parse the JSON output containing: `lines` (6 values: 6/7/8/9), `lower`/`upper` (trigram indices), `lowerTrigram`/`upperTrigram` (name/element/nature), `hex` (name/full/u), `changing` (array of changing line indices), `transformed` (changed hexagram, if any).

## 3. Display the Hexagram

Line display rules:
- `7` (少阳): `━━━━━`
- `8` (少阴): `━━ ━━`
- `9` (老阳, changing): `━━━━━ ⊙` + mark 动
- `6` (老阴, changing): `━━ ━━ ⊗` + mark 动

```
☯ 卦象

本卦: {fullName} {unicode}
上卦: {upper.name}（{upper.nature}/{upper.element}）
下卦: {lower.name}（{lower.nature}/{lower.element}）

六爻（从下到上）:
上爻: ━━━━━
五爻: ━━ ━━
四爻: ━━━━━ ⊙ 动
三爻: ━━━━━
二爻: ━━ ━━
初爻: ━━━━━

动爻: 第N爻（从下数）
变卦: {transformed.fullName} {transformed.unicode}
```

If no changing lines → 静卦 (no 变卦).

## 4. Call Claude API for Interpretation

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
    "system": "你是一位精通周易六爻的占卜大师，深谙六十四卦卦义、六爻爻辞、动爻变化。\n\n你的知识涵盖：\n- 六十四卦卦义与卦辞\n- 六爻爻位含义（初爻至上爻）\n- 动爻变化与变卦推演\n- 上下卦（八卦）五行生克关系\n- 本卦为现状，变卦为趋势\n\n解卦要结合本卦变卦，分析吉凶趋势，给出实用建议。\n每段结尾标注：「占卜仅供参考，请理性看待」",
    "messages": [{"role": "user", "content": "<PROMPT>"}]
  }'
```

Build `<PROMPT>`:

```
请对以下周易六爻卦象进行占卜分析：

{question ? "问题：" + question : "（随机起卦，求总体运势）"}

本卦：{hex.fullName} {hex.unicode}
上卦：{upper.name}（{upper.nature}/{upper.element}）
下卦：{lower.name}（{lower.nature}/{lower.element}）

六爻爻象（从下到上）：
{formatted lines with 初爻~上爻 labels, marking changing lines}

{changingLines.length > 0 ? "动爻：第N爻（从下数）" : "无动爻（静卦）"}
{transformed ? "变卦：" + transformed.fullName + " " + transformed.unicode : ""}

请进行六爻解析，包括：
1. 本卦{fullName}的卦义与象征
2. 上下卦的关系解读
3. 动爻的含义与变化趋势
4. {transformed ? "变卦的启示" : "静卦的稳定性分析"}
5. 针对所问的具体建议
```

## 5. Present Results

Parse SSE stream and print text deltas as they arrive. Format with markdown headers.

## Notes

- 老阳(9) and 老阴(6) are changing lines — they drive the transformation to 变卦
- 本卦 shows the current situation; 变卦 shows where things are heading
- If no changing lines (静卦), focus entirely on the 本卦 meaning
