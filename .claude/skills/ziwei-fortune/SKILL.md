---
name: ziwei-fortune
description: 紫微斗数命理分析 (Zi Wei Dou Shu purple star astrology). Use this skill whenever the user asks for 紫微斗数、紫微、命宫、身宫、十二宫、大限 analysis, or wants a Zi Wei Dou Shu chart reading from birth date. Triggers for Chinese astrology requests mentioning 五行局、纳音、紫微星 or palace-based fortune analysis.
user_invocable: true
---

# 紫微斗数分析

## 收集信息

从用户消息中提取，缺少的字段需追问：
- **出生年/月/日/时** (24小时制)
- **性别** (男/女)
- **分析方向**: 性格命格 / 事业官禄 / 婚姻夫妻 / 财帛运势 / 大限流年

## 计算命盘

```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/ziwei-fortune/scripts/calc.js <year> <month> <day> <hour>
```

## 展示结果

简洁展示命盘核心信息：

```
⭐ 紫微命盘
命宫: {branch}宫 | 身宫: {branch}宫
纳音: {nayinName} | 五行局: {wuxingJu.name}
十二宫: 命宫(X) 兄弟(X) 夫妻(X) 子女(X) 财帛(X) 疾厄(X) 迁移(X) 仆役(X) 官禄(X) 田宅(X) 福德(X) 父母(X)
```

## 调用 AI 分析

确定 API 配置:
```bash
API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
API_HOST="${CLAUDE_API_HOST:-https://api.anthropic.com}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-6}"
```

无 API key 时仅展示命盘数据并提示用户配置。

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
你是精通紫微斗数的命理师。分析风格：结论先行、重点突出、建议可执行。
要求：
1. 先给出一句话总评（命格定性）
2. 围绕所问方向分析关键宫位（2-3段，直接给结论）
3. 最后必须给出「行动建议」清单（3-5条具体可执行的建议）
每条建议格式：✅ [具体行为] — [原因]
结尾标注「命理仅供参考，请理性看待」
```

**User prompt 模板:**
```
紫微命盘: 命宫{mingGongBranch} 身宫{shenGongBranch} {wuxingJu.name}
纳音: {nayinName} | 性别: {gender}
十二宫: {palaces formatted}
分析方向: {aspect}

请分析并给出行动建议。
```

## 输出要求

流式输出 AI 分析结果。确保最终展示包含：
1. 命盘数据（简表）
2. **核心判断**（2-3段，不堆砌推演过程）
3. **行动建议清单**（✅ 格式，具体可执行）
