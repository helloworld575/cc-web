---
name: liuyao-fortune
description: 周易六爻占卜分析 (I Ching Liu Yao divination). Use this skill whenever the user asks for 周易、六爻、卦象、占卜 readings, wants to ask the I Ching a question, or mentions 本卦、变卦、动爻 interpretation. Also triggers for general 易经 questions about a specific situation or decision.
user_invocable: true
---

# 周易六爻占卜

## 收集信息

从用户消息中提取，缺少的字段用默认值：
- **起卦方式**: `random`(摇卦，默认) 或 `time`(时间起卦)
- **所问之事** (可选，改善分析精度)
- 若 `time`: 年/月/日/时

用户说"帮我起一卦"/"占卜一下" → 用 `random`。

## 起卦

```bash
# 随机
node /Users/bytedance/claude_place/my-site/.claude/skills/liuyao-fortune/scripts/calc.js random
# 时间
node /Users/bytedance/claude_place/my-site/.claude/skills/liuyao-fortune/scripts/calc.js time <year> <month> <day> <hour>
```

## 展示卦象

简洁展示本卦和变卦：

```
☯ 卦象
本卦: {fullName} {unicode}
上卦: {name}({nature}/{element}) | 下卦: {name}({nature}/{element})
动爻: 第N爻 → 变卦: {transformed.fullName} {transformed.unicode}
```

爻象可用一行表示: `初七 二八 三九⊙ 四七 五八 上七` (标记动爻即可)

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
你是精通周易六爻的占卜师。分析风格：结论先行、直指吉凶、建议可执行。
要求：
1. 先给出一句话断卦（吉/凶/平，总体走势）
2. 解读本卦与变卦核心含义（2段，不逐爻堆砌）
3. 最后必须给出「行动建议」清单（3-5条具体可执行的建议）
每条建议格式：✅ [具体行为] — [原因]
结尾标注「占卜仅供参考，请理性看待」
```

**User prompt 模板:**
```
本卦: {fullName} | 上卦: {upper.name}({upper.element}) 下卦: {lower.name}({lower.element})
六爻: {lines} | 动爻: {changingLines}
{transformed ? "变卦: " + transformed.fullName : "静卦"}
{question ? "所问: " + question : "求总体运势"}

请断卦并给出行动建议。
```

## 输出要求

流式输出 AI 分析结果。确保最终展示包含：
1. 卦象数据（简表）
2. **吉凶判断 + 核心解读**（2段，不逐爻堆砌过程）
3. **行动建议清单**（✅ 格式，具体可执行）
