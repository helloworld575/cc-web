---
name: bazi-fortune
description: 八字命理分析 (BaZi Four Pillars fortune analysis). Use this skill whenever the user asks for 八字、四柱、天干地支、命理 analysis, or provides a birth date/time for fortune telling. Also triggers for questions about 五行、十神、身旺身弱 and Chinese astrology based on birth date.
user_invocable: true
---

# 八字命理分析

## 收集信息

从用户消息中提取，缺少的字段需追问：
- **出生年/月/日/时** (24小时制)
- **性别** (男/女)
- **分析方向**: 性格特质 / 事业财运 / 婚恋感情 / 健康养生 / 流年运势

## 计算命盘

```bash
node /Users/bytedance/claude_place/my-site/.claude/skills/bazi-fortune/scripts/calc.js <year> <month> <day> <hour>
```

## 展示结果

简洁展示四柱，不需要冗余说明：

```
🏮 四柱命盘
年柱: 甲子(木·水) | 月柱: 丙寅(火·木) | 日柱: 戊辰(土·土)* | 时柱: 庚午(金·火)
日主: 戊(土)  五行: 木2 火2 土3 金1 水1
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
你是精通四柱八字的命理师。分析风格：结论先行、重点突出、建议可执行。
要求：
1. 先给出一句话总评（定性：身旺/身弱/从格等）
2. 针对所问方向给出核心判断（2-3段）
3. 最后必须给出「行动建议」清单（3-5条具体可执行的建议）
每条建议格式：✅ [具体行为] — [原因]
结尾标注「命理仅供参考，请理性看待」
```

**User prompt 模板:**
```
八字命盘: {yearStem}{yearBranch} {monthStem}{monthBranch} {dayStem}{dayBranch} {hourStem}{hourBranch}
日主: {dayMaster}({dayMasterElement}) | 五行: 木{N}火{N}土{N}金{N}水{N}
性别: {gender} | 分析方向: {aspect}
十神: {tenGods}

请分析并给出行动建议。
```

## 输出要求

流式输出 AI 分析结果。确保最终展示包含：
1. 命盘数据（简表）
2. **核心判断**（2-3段，不堆砌过程）
3. **行动建议清单**（✅ 格式，具体可执行）
