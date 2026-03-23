---
name: meihua-fortune
description: 梅花易数占卜分析 (Mei Hua Yi Shu plum blossom numerology divination). Use this skill whenever the user asks for 梅花易数、体卦、用卦、梅花 readings, wants to use numbers or time to generate a hexagram, or asks about 邵康节 divination method. Also triggers when users want a quick I Ching reading using numbers (like spotting a number and asking what it means).
user_invocable: true
---

# 梅花易数占卜

## 收集信息

从用户消息中提取，缺少的字段用默认值：
- **起卦方式**: `random`(默认) / `time`(时间) / `number`(数字)
- **所问之事** (可选)
- 若 `time`: 年/月/日/时
- 若 `number`: 上卦数、下卦数

数字来源可以是生活中任何偶然数（门牌号、时间、随机数等）。

## 起卦

```bash
# 随机
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js random
# 时间
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js time <year> <month> <day> <hour>
# 数字
node /Users/bytedance/claude_place/my-site/.claude/skills/meihua-fortune/scripts/calc.js number <n1> <n2>
```

## 展示卦象

简洁展示体用关系（这是梅花的核心）：

```
🌸 梅花易数
本卦: {fullName}
体卦(下/主): {lower.name}({lower.element}) → 用卦(上/客): {upper.name}({upper.element})
体用关系: {element}→{element} = {生克关系}
动爻: 第N爻 | 变卦: {transformed.fullName}
```

体用五行关系速判：
- 用生体 → 最吉（得助力）
- 体克用 → 吉（我主导）
- 体用同 → 平（无大波澜）
- 体生用 → 耗（主动付出）
- 用克体 → 凶（受阻碍）

## 调用 AI 分析

确定 API 配置:
```bash
API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
API_HOST="${CLAUDE_API_HOST:-https://api.anthropic.com}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
```

无 API key 时仅展示卦象并提示用户配置。

流式请求:
```bash
curl -s -N "${API_HOST%/}/v1/messages" \
  -H "x-api-key: ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '<JSON_BODY>'
```

**System prompt:**
```
你是精通梅花易数的占卜师，深谙邵康节体用之法。分析风格：结论先行、直判吉凶、建议可执行。
要求：
1. 先给出一句话断卦（体用关系 → 吉凶定性）
2. 分析体卦与用卦的五行关系及事态走向（2段，不堆砌理论）
3. 最后必须给出「行动建议」清单（3-5条具体可执行的建议）
每条建议格式：✅ [具体行为] — [原因]
结尾标注「占卜仅供参考，请理性看待」
```

**User prompt 模板:**
```
本卦: {fullName}
体卦(下): {lower.name}({lower.element}) | 用卦(上): {upper.name}({upper.element})
体用关系: {lower.element}与{upper.element}
动爻: {movingLine} | 变卦: {transformed.fullName}
{question ? "所问: " + question : "求总体指引"}

请断卦并给出行动建议。
```

## 输出要求

流式输出 AI 分析结果。确保最终展示包含：
1. 卦象 + 体用关系（简表）
2. **吉凶判断 + 核心解读**（2段，不堆砌理论过程）
3. **行动建议清单**（✅ 格式，具体可执行）
